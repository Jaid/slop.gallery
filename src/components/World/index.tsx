import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'
import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {ComponentType} from 'react'

import {useFrame} from '@react-three/fiber'
import {startTransition, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {Vector3} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery.ts'
import {clearRooms, endRoom, expectRooms, startRoom} from '#src/lib/gallery/roomLoading.ts'
import {roomsAt} from '#src/lib/gallery/roomVisibility.ts'
import {trackLoadingPromise} from '#src/lib/loadingItems.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import relations from '#src/worlds/gallery/relations.ts'

/** Each room owns its architecture and contents, including the Lobby. Nothing imports a room’s render module before it is admitted. */
const loaders = {
  lobby: () => import('#src/rooms/lobby/scene.tsx'),
  vesper: () => import('#src/rooms/vesper/scene.tsx'),
  banquet: () => import('#src/rooms/banquet/scene.tsx'),
  antechamber: () => import('#src/rooms/antechamber/scene.tsx'),
  sienna: () => import('#src/rooms/sienna/scene.tsx'),
  salon: () => import('#src/rooms/salon/scene.tsx'),
  forge: () => import('#src/rooms/forge/scene.tsx'),
  lodge: () => import('#src/rooms/lodge/scene.tsx'),
  bastion: () => import('#src/rooms/bastion/scene.tsx'),
  corridor: () => import('#src/rooms/corridor/scene.tsx'),
  moonfall: () => import('#src/rooms/moonfall/scene.tsx'),
  oculus: () => import('#src/rooms/oculus/scene.tsx'),
  exhibition: () => import('#src/rooms/exhibition/scene.tsx'),
} satisfies Record<RoomId, () => Promise<{default: ComponentType<{materials: GalleryMaterials}>}>>
type RoomPart = ComponentType<{materials: GalleryMaterials}>
const includedRooms = slopGallery.reachableRooms.map(room => room.id)
// Hold physics only for rooms that this page can actually mount.
expectRooms(includedRooms)
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
  return [...order, ...includedRooms.filter(room => !order.includes(room))]
}

/** Streams admitted rooms, the camera’s rooms first and then the rest, without ever expanding the startup reach. */
export default function World({materials}: {materials: GalleryMaterials}) {
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
    if (asked.current.size < includedRooms.length) {
      const from = roomsAt(camera.getWorldPosition(position).toArray())
      const wanted = useGallery.getState().ready || !from.length ? nearestFirst(from) : from
      for (const room of wanted) {
        if (!includedRooms.includes(room) || asked.current.has(room)) {
          continue
        }
        asked.current.set(room, null)
        startRoom(room)
        // Listed apart from the room, which only a frame mounts, so a frozen world that stopped drawing while it downloaded is drawn again once it is in.
        trackLoadingPromise(`room-chunk:${room}`, loaders[room]()).then(part => {
          asked.current.set(room, part.default)
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
  return <group name='world'>
    {parts.map(([room, Part]) => <group key={room} userData={{room}}><Part materials={materials} /></group>)}
  </group>
}
