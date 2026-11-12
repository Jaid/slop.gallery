import type {createArchitecturalGlassMaterials} from '#src/lib/materials/ArchitecturalGlassMaterials.ts'
import type LodgeMaterials from '#src/lib/materials/LodgeMaterials.ts'
import type SiennaRoom from '#src/rooms/sienna/components/SiennaRoom/index.tsx'
import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {ReactNode} from 'react'
import type {NodeMaterial, Texture} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {startTransition, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {Vector3} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery.ts'
import {clearRooms, endRoom, expectRooms, startRoom} from '#src/lib/gallery/roomLoading.ts'
import {roomsAt} from '#src/lib/gallery/roomVisibility.ts'
import LobbyRoom from '#src/rooms/lobby/components/LobbyRoom/index.tsx'
import relations from '#src/worlds/gallery/relations.ts'

/** the materials the rooms share with each other and with the walls around them */
export type WorldMaterials = {
  castleStone: NodeMaterial
  corridorWood: NodeMaterial
  glass: ReturnType<typeof createArchitecturalGlassMaterials>
  joinery: Parameters<typeof SiennaRoom>[0]['joinery']
  lobbyWall: NodeMaterial
  lodge: LodgeMaterials
  oculus: NodeMaterial
  stone: Texture
  windowReveal: NodeMaterial
  wood: Texture
}

/** a room with what it builds beyond its walls */
type RoomPart = (materials: WorldMaterials) => ReactNode
type LaterRoom = Exclude<RoomId, 'lobby'>

/** Every room but the Lobby, each in chunks of its own that only download once the world asks for the room. */
const loaders: Record<LaterRoom, () => Promise<RoomPart>> = {
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
      <LodgeWindow glass={glass.cabin} material={windowReveal} stone={castleStone} />
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
    const {default: Room} = await import('#src/rooms/moonfall/components/MoonfallRoom/index.tsx')
    return () => <Room />
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
const laterRooms = Object.keys(loaders) as Array<LaterRoom>
// Holds the physics from before its first step until every room is in.
expectRooms(laterRooms)
const isLater = (room: RoomId): room is LaterRoom => room in loaders
const position = new Vector3
/** Every later room, nearest first: the given rooms, the rooms they see into, the rooms those see into and so on. */
const nearestFirst = (from: ReadonlyArray<RoomId>) => {
  const order: Array<RoomId> = []
  let round: ReadonlyArray<RoomId> = from
  while (round.length > 0) {
    order.push(...round)
    // The next round is the rooms that this round sees into.
    round = [...new Set(round.flatMap(room => relations[room].rooms))].filter(room => !order.includes(room))
  }
  return [...order, ...laterRooms.filter(room => !order.includes(room))]
}

/**
 * Every room of the gallery, each with what it builds beyond its walls.
 * The Lobby, where visitors start, comes with the page. Behind the loading screen, only the rooms the camera is in load too, or every room outside of all rooms, where culling leaves nothing out.
 * The rest download once Enter is enabled and mount one at a time, nearest first, so that no single frame sets them all up.
 */
export default function World(materials: WorldMaterials) {
  const {glass, lobbyWall, stone, wood} = materials
  const [parts, setParts] = useState<ReadonlyArray<readonly [LaterRoom, RoomPart]>>([])
  /** each room asked for, with its part once it loaded */
  const asked = useRef(new Map<LaterRoom, RoomPart | null>)
  const mounted = useRef(new Set<LaterRoom>)
  const mounting = useRef<LaterRoom>(null)
  useEffect(() => clearRooms, [])
  useLayoutEffect(() => {
    if (mounting.current && parts.some(([room]) => room === mounting.current)) {
      endRoom(mounting.current)
      mounting.current = null
    }
  }, [parts])
  useFrame(({camera}) => {
    if (asked.current.size < laterRooms.length) {
      const from = roomsAt(camera.getWorldPosition(position).toArray())
      const wanted = useGallery.getState().ready || !from.length ? nearestFirst(from) : from
      for (const room of wanted) {
        if (!isLater(room) || asked.current.has(room)) {
          continue
        }
        asked.current.set(room, null)
        startRoom(room)
        loaders[room]().then(part => {
          asked.current.set(room, part)
        }).catch((error: unknown) => {
          console.warn(`The ${room} room could not be loaded:`, error)
          endRoom(room, true)
        })
      }
    }
    if (mounting.current) {
      return
    }
    const next = asked.current.entries().find((entry): entry is [LaterRoom, RoomPart] => entry[1] !== null && !mounted.current.has(entry[0]))
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
    <group userData={{room: 'lobby'}}>
      <LobbyRoom cladding={lobbyWall} glass={glass.lobby} stone={stone} wood={wood} />
    </group>
    {parts.map(([room, part]) => <group key={room} userData={{room}}>{part(materials)}</group>)}
  </group>
}
