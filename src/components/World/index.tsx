import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'
import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {ReactNode} from 'react'

import {useFrame} from '@react-three/fiber'
import {startTransition, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {Vector3} from 'three/webgpu'

import GalleryWalls from '#component/GalleryWalls'
import {useGallery} from '#src/lib/gallery.ts'
import {clearRooms, endRoom, expectRooms, startRoom} from '#src/lib/gallery/roomLoading.ts'
import {roomsAt} from '#src/lib/gallery/roomVisibility.ts'
import {trackLoadingPromise} from '#src/lib/loadingItems.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import relations from '#src/worlds/gallery/relations.ts'

export type WorldMaterials = GalleryMaterials

/** a room with what it builds beyond its walls */
type RoomPart = (materials: WorldMaterials) => ReactNode

/** Every room, including the Lobby, behind its own loading boundary. */
const loaders: Record<RoomId, () => Promise<RoomPart>> = {
  lobby: async () => {
    const {default: Room} = await import('#src/rooms/lobby/components/LobbyRoom/index.tsx')
    return ({glass, lobbyWall, stone, wood}) => <Room cladding={lobbyWall} glass={glass.lobby} stone={stone} wood={wood} />
  },
  vesper: async () => {
    const {default: Room} = await import('#src/rooms/vesper/components/VesperRoom/index.tsx')
    return ({glass, stone, wood}) => <Room glass={glass.lobby} stone={stone} wood={wood} />
  },
  banquet: async () => {
    const {default: Room} = await import('#src/rooms/banquet/components/BanquetRoom/index.tsx')
    return ({glass, stone, wood}) => <Room glass={glass.lobby} stone={stone} wood={wood} />
  },
  antechamber: async () => {
    const {default: Room} = await import('#src/rooms/antechamber/components/AntechamberRoom/index.tsx')
    return ({glass, stone, wood}) => <Room glass={glass.lobby} stone={stone} wood={wood} />
  },
  sienna: async () => {
    const {default: Room} = await import('#src/rooms/sienna/components/SiennaRoom/index.tsx')
    return ({joinery}) => <Room joinery={joinery} />
  },
  salon: async () => {
    const [{default: Room}, {default: LobbyWindow}, {salonWindow}] = await Promise.all([import('#src/rooms/salon/components/SalonRoom/index.tsx'), import('#component/LobbyWindow'), import('#src/lib/gallery/lobbyWindows.ts')])
    return ({glass, stone, wood}) => <>
      <Room glass={glass.lobby} stone={stone} wood={wood} />
      <LobbyWindow glass={glass.lobbyWindow} glazing={salonWindow} name='salon-window' />
    </>
  },
  forge: async () => {
    const [{default: Room}, {default: LobbyWindow}, {forgeWindow}] = await Promise.all([import('#src/rooms/forge/components/ForgeRoom/index.tsx'), import('#component/LobbyWindow'), import('#src/lib/gallery/lobbyWindows.ts')])
    return ({castleStone, glass, stone, wood}) => <>
      <Room glass={glass.lobby} masonry={castleStone} stone={stone} wood={wood} />
      <LobbyWindow glass={glass.lobbyWindow} glazing={forgeWindow} name='forge-window' />
    </>
  },
  lodge: async () => {
    const [{default: Room}, {default: LodgeWindow}, {default: LodgeThreshold}] = await Promise.all([import('#src/rooms/lodge/components/LodgeRoom/index.tsx'), import('#component/LodgeWindow'), import('#src/rooms/lodge/components/LodgeThreshold/index.tsx')])
    return ({castleStone, glass, lodge, windowReveal, wood}) => <>
      <Room materials={lodge} />
      <LodgeWindow glass={glass.cabin} masonry={castleStone} material={windowReveal} />
      <LodgeThreshold wood={wood} />
    </>
  },
  bastion: async () => {
    const {default: Room} = await import('#src/rooms/bastion/components/BastionRoom/index.tsx')
    return ({castleStone, wood}) => <Room material={castleStone} wood={wood} />
  },
  corridor: async () => {
    const {default: Room} = await import('#src/rooms/corridor/components/CorridorRoom/index.tsx')
    return ({corridorWood, wood}) => <Room lining={corridorWood} wood={wood} />
  },
  moonfall: async () => {
    const [{default: Room}, {default: Stairs}] = await Promise.all([import('#src/rooms/moonfall/components/MoonfallRoom/index.tsx'), import('#component/GalleryStairs')])
    return () => <><Room /><Stairs /></>
  },
  oculus: async () => {
    const {default: Room} = await import('#src/rooms/oculus/components/OculusRoom/index.tsx')
    return ({castleStone, oculus}) => <Room material={oculus} stone={castleStone} />
  },
  exhibition: async () => {
    const {default: Room} = await import('#src/rooms/exhibition/components/ExhibitionRoom/index.tsx')
    return ({oculus}) => <Room material={oculus} />
  },
}
/** The one fixed startup scope also bounds downloads, mount accounting and the physics hold. */
const roomIds = slopGallery.reachedRooms.map(room => room.id)
expectRooms(roomIds)
const position = new Vector3
/** Every reached room, nearest first: the given rooms, the rooms they see into, the rooms those see into and so on. */
const nearestFirst = (from: ReadonlyArray<RoomId>) => {
  const order: Array<RoomId> = []
  let round: ReadonlyArray<RoomId> = from
  while (round.length > 0) {
    order.push(...round)
    // The next round is the rooms that this round sees into.
    round = [...new Set(round.flatMap(room => relations[room].rooms))].filter(room => !order.includes(room))
  }
  return [...order, ...roomIds.filter(room => !order.includes(room))].filter(room => slopGallery.reach.includes(room))
}

/** Streams only reached rooms, nearest first, one mount at a time. Each loading boundary includes the room’s walls and attachments, so an excluded room cannot sneak in through the global architecture. */
export default function World({materials}: {materials: WorldMaterials}) {
  const [parts, setParts] = useState<ReadonlyArray<readonly [RoomId, RoomPart]>>([])
  /** each room asked for, with its part once it loaded */
  const asked = useRef(new Map<RoomId, RoomPart | null>)
  const mounted = useRef(new Set<RoomId>)
  const mounting = useRef<RoomId>(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      clearRooms()
    }
  }, [])
  useLayoutEffect(() => {
    if (mounting.current && parts.some(([room]) => room === mounting.current)) {
      endRoom(mounting.current)
      mounting.current = null
    }
  }, [parts])
  useFrame(({camera}) => {
    if (asked.current.size < roomIds.length) {
      const from = roomsAt(camera.getWorldPosition(position).toArray()).filter(room => slopGallery.reach.includes(room))
      const wanted = useGallery.getState().ready || !from.length ? nearestFirst(from) : from
      for (const room of wanted) {
        if (asked.current.has(room)) {
          continue
        }
        asked.current.set(room, null)
        startRoom(room)
        // Listed apart from the room, which only a frame mounts, so a frozen world that stopped drawing while it downloaded is drawn again once it is in.
        trackLoadingPromise(`room-chunk:${room}`, loaders[room]()).then(part => {
          if (active.current) {
            asked.current.set(room, part)
          }
        }).catch((error: unknown) => {
          if (!active.current) {
            return
          }
          console.warn(`The ${room} room could not be loaded:`, error)
          endRoom(room, true)
        })
      }
    }
    if (mounting.current) {
      return
    }
    const next = asked.current.entries().find((entry): entry is [RoomId, RoomPart] => entry[1] !== null && !mounted.current.has(entry[0]))
    if (!next) {
      return
    }
    const [room, part] = next
    mounted.current.add(room)
    mounting.current = room
    // A transition lets React build the room’s objects over several tasks.
    startTransition(() => {
      setParts(previous => [...previous, [room, part]])
    })
  })
  // Each room owns everything its part builds, see ownerRoom.
  return <group name='world'>
    {parts.map(([room, part]) => <group key={room} userData={{room}}><GalleryWalls materials={materials} room={room} />{part(materials)}</group>)}
  </group>
}
