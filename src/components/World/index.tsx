import type ArchitecturalGlassMaterials from '#src/lib/materials/ArchitecturalGlassMaterials.ts'
import type LodgeMaterials from '#src/lib/materials/LodgeMaterials.ts'
import type SiennaRoom from '#src/rooms/sienna/components/SiennaRoom/index.tsx'
import type WorldReach from '#src/worlds/base/WorldReach.ts'
import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {ReactNode} from 'react'
import type {NodeMaterial, Texture} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {Fragment, startTransition, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {Vector3} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery.ts'
import {clearRooms, endRoom, expectRooms, startRoom} from '#src/lib/gallery/roomLoading.ts'
import {roomsAt} from '#src/lib/gallery/roomVisibility.ts'
import {trackLoadingPromise} from '#src/lib/loadingItems.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import relations from '#src/worlds/gallery/relations.ts'

/** the materials the rooms share with each other and with the walls around them, of which a room’s part only reads those it uses, so that rooms out of reach never make theirs */
export type WorldMaterials = {
  castleStone: NodeMaterial
  corridorWood: NodeMaterial
  glass: ArchitecturalGlassMaterials
  joinery: Parameters<typeof SiennaRoom>[0]['joinery']
  lobbyWall: NodeMaterial
  lodge: LodgeMaterials
  oculus: NodeMaterial
  stone: Texture
  windowReveal: NodeMaterial
  wood: Texture
}

/** what fills an opening between two rooms, like the glass of a window through both of their walls */
export type OpeningFill = {
  load: () => Promise<RoomPart>
  /** the rooms it lies between, the one it comes with first, see {@link roomParts} */
  rooms: readonly [RoomId, RoomId]
}
/** a room with what it builds beyond its walls */
type RoomPart = (materials: WorldMaterials) => ReactNode

const {reach} = slopGallery
/** Every room, each in chunks of its own that only download once the world asks for the room. */
const roomLoaders: Record<RoomId, () => Promise<RoomPart>> = {
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
    const {default: Room} = await import('#src/rooms/salon/components/SalonRoom/index.tsx')
    return ({glass, stone, wood}) => <Room glass={glass.lobby} stone={stone} wood={wood} />
  },
  forge: async () => {
    const {default: Room} = await import('#src/rooms/forge/components/ForgeRoom/index.tsx')
    return ({castleStone, glass, stone, wood}) => <Room glass={glass.lobby} masonry={castleStone} stone={stone} wood={wood} />
  },
  lodge: async () => {
    const [{default: Room}, {default: LodgeThreshold}] = await Promise.all([import('#src/rooms/lodge/components/LodgeRoom/index.tsx'), import('#src/rooms/lodge/components/LodgeThreshold/index.tsx')])
    return ({lodge, wood}) => <>
      <Room materials={lodge} />
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
    return ({oculus}) => <Room material={oculus} />
  },
  exhibition: async () => {
    const {default: Room} = await import('#src/rooms/exhibition/components/ExhibitionRoom/index.tsx')
    return ({oculus}) => <Room material={oculus} />
  },
}
/**
 * What fills the openings between two rooms, each in chunks of its own, which come with the first of its rooms that this page mounts: a glass wall shows from both sides even while the room behind it is out of reach, and only the void lies beyond.
 * With every room in reach, each comes with the room that held it before there was a reach to keep in mind.
 */
export const openingFills: ReadonlyArray<OpeningFill> = [
  {
    rooms: ['salon', 'lobby'],
    load: async () => {
      const [{default: LobbyWindow}, {salonWindow}] = await Promise.all([import('#component/LobbyWindow'), import('#src/lib/gallery/lobbyWindows.ts')])
      return ({glass}) => <LobbyWindow glass={glass.lobbyWindow} glazing={salonWindow} name='salon-window' />
    },
  },
  {
    rooms: ['forge', 'lobby'],
    load: async () => {
      const [{default: LobbyWindow}, {forgeWindow}] = await Promise.all([import('#component/LobbyWindow'), import('#src/lib/gallery/lobbyWindows.ts')])
      return ({glass}) => <LobbyWindow glass={glass.lobbyWindow} glazing={forgeWindow} name='forge-window' />
    },
  },
  {
    rooms: ['lodge', 'corridor'],
    load: async () => {
      const {LodgeTunnelWindow} = await import('#component/LodgeWindow')
      return ({glass, windowReveal}) => <LodgeTunnelWindow glass={glass.cabin} material={windowReveal} />
    },
  },
  {
    rooms: ['lodge', 'bastion'],
    load: async () => {
      const {LodgeEastWindow} = await import('#component/LodgeWindow')
      return ({castleStone, glass, windowReveal}) => <LodgeEastWindow glass={glass.cabin} masonry={castleStone} material={windowReveal} />
    },
  },
  {
    // The bars of the apse’s gate and windows, lined through the gap between the apse’s wall and the Bastion’s.
    rooms: ['oculus', 'bastion'],
    load: async () => {
      const {default: ApseGrilles} = await import('#src/rooms/oculus/components/ApseGrilles/index.tsx')
      return ({castleStone}) => <ApseGrilles stone={castleStone} />
    },
  },
]
/** What a page with the reach loads: the rooms in reach, in the gallery’s order, each with the fills of the openings it hosts, the first of the opening’s rooms in reach. */
export function roomParts(within: Pick<WorldReach, 'covers'>): ReadonlyMap<RoomId, ReadonlyArray<OpeningFill>> {
  const hosted = Map.groupBy(openingFills.filter(fill => fill.rooms.some(room => within.covers(room))), (fill): RoomId => fill.rooms.find(room => within.covers(room))!)
  const rooms = slopGallery.rooms.map((room): RoomId => room.id).filter(room => within.covers(room))
  return new Map(rooms.map(room => [room, hosted.get(room) ?? []]))
}
/** Everything the room brings: its own part and the fills of the openings it hosts. */
const partLoader = (room: RoomId, fills: ReadonlyArray<OpeningFill>) => async (): Promise<RoomPart> => {
  const parts = await Promise.all([roomLoaders[room](), ...fills.map(fill => fill.load())])
  return materials => parts.map((part, index) => <Fragment key={index}>{part(materials)}</Fragment>)
}
const loaders = new Map(roomParts(reach).entries().map(([room, fills]) => [room, partLoader(room, fills)] as const))
const reachedRooms: ReadonlyArray<RoomId> = loaders.keys().toArray()
// Holds the physics from before its first step until every room is in.
expectRooms(reachedRooms)
const isReached = (room: RoomId) => loaders.has(room)
const position = new Vector3
/** Every room in reach, nearest first: the given rooms, the rooms they see into, the rooms those see into and so on. */
const nearestFirst = (from: ReadonlyArray<RoomId>): ReadonlyArray<RoomId> => {
  const order: Array<RoomId> = []
  let round: ReadonlyArray<RoomId> = from
  while (round.length > 0) {
    order.push(...round)
    // The next round is the rooms that this round sees into.
    round = [...new Set(round.flatMap(room => relations[room].rooms))].filter(room => !order.includes(room))
  }
  return [...order, ...reachedRooms.filter(room => !order.includes(room))]
}

/**
 * Every room of the gallery in reach of this page, see `World.reach`, each with what it builds beyond its walls, in chunks of its own; rooms out of reach never download.
 * Behind the loading screen, only the rooms the camera is in load, or every room outside of all rooms, where culling leaves nothing out.
 * The rest download once Enter is enabled. They mount one at a time, nearest first, so that no single frame sets them all up.
 */
export default function World({materials}: {
  /** what the rooms share, which a room only makes by asking for it */
  materials: WorldMaterials
}) {
  const [parts, setParts] = useState<ReadonlyArray<readonly [RoomId, RoomPart]>>([])
  /** each room asked for, with its part once it loaded */
  const asked = useRef(new Map<RoomId, RoomPart | null>)
  const mounted = useRef(new Set<RoomId>)
  const mounting = useRef<RoomId>(null)
  useEffect(() => clearRooms, [])
  useLayoutEffect(() => {
    if (mounting.current && parts.some(([room]) => room === mounting.current)) {
      endRoom(mounting.current)
      mounting.current = null
    }
  }, [parts])
  useFrame(({camera}) => {
    if (asked.current.size < reachedRooms.length) {
      const from = roomsAt(camera.getWorldPosition(position).toArray())
      const wanted = useGallery.getState().ready || !from.length ? nearestFirst(from) : from
      for (const room of wanted) {
        if (!isReached(room) || asked.current.has(room)) {
          continue
        }
        asked.current.set(room, null)
        startRoom(room)
        // Listed apart from the room, which only a frame mounts, so a frozen world that stopped drawing while it downloaded is drawn again once it is in.
        trackLoadingPromise(`room-chunk:${room}`, loaders.get(room)!()).then(part => {
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
    {parts.map(([room, part]) => <group key={room} userData={{room}}>{part(materials)}</group>)}
  </group>
}
