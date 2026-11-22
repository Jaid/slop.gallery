import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type {FloorSize} from '#src/rooms/index.ts'
import type {Material, Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {color, mix, texture} from 'three/tsl'
import {MeshPhysicalNodeMaterial, MeshStandardNodeMaterial} from 'three/webgpu'
import {useGraphicsModeValue} from 'use-graphics-mode'

import {surfaceTexture} from '#src/components/Scene/materials.ts'
import WallSurface from '#src/components/Scene/WallSurface.tsx'
import {CheckeredMarbleFloorMaterial, cremaMarfil, neroMarquina} from '#src/lib/materials/marble/index.ts'
import VelvetWallMaterial from '#src/lib/materials/VelvetWallMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

/** the Arena’s materials, apart from its floor’s */
export type ArenaSurfaces = {
  /** the dark plaster of the ceiling */
  ceiling: Material
  plaster: Texture
  /** the black lacquered baseboards and cornices */
  trim: Material
  /** the crushed velvet of the walls */
  velvet: Material
}
/** how the Arena’s marble mirrors the room in heavy mode */
export type ArenaPolish = {
  /** extra share of the mirror at grazing angles */
  grazingStrength: number
  /** share of the mirror when looking straight down */
  strength: number
}
export type ArenaShellProps = {
  /** the middle of the floor plan, in world meters */
  center: Point
  /** a corner of the floor’s tile grid, in world meters */
  floorOrigin: Point
  /** how high the ceiling hangs over the floor, which lies at y = 0 */
  height: number
  /** how clearly the marble mirrors the room, faintly by default */
  polish?: ArenaPolish
  size: FloorSize
  surfaces: ArenaSurfaces
  /** edge length of the floor’s marble tiles */
  tile: number
  /** the walls around the floor plan, as the world placed and mitered them */
  walls: ReadonlyArray<Wall>
}
type Point = readonly [x: number, z: number]

/** The Arena’s own faint mirror: a whisper of the room, which the floor’s veins and the lamps’ highlights outshine. */
const faintPolish: ArenaPolish = {
  strength: 0.2,
  grazingStrength: 0,
}

/** The Arena’s baseboards and cornices in black semi-gloss paint under a clear lacquer, which draws a crisp line of light along every edge. */
export function createArenaTrim() {
  return new MeshPhysicalNodeMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    color: '#141315',
    envMapIntensity: 0.6,
    metalness: 0,
    roughness: 0.42,
  })
}

/** The Arena’s walls, trim and ceiling, which one or more shells and their annexes can share. */
export function useArenaSurfaces(): ArenaSurfaces {
  const {surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const plaster = useDisposable(useMemo(() => surfaceTexture('plaster', surfaceAnisotropy), [surfaceAnisotropy]))
  const velvet = useDisposable(useMemo(() => new VelvetWallMaterial, []))
  const trim = useDisposable(useMemo(createArenaTrim, []))
  const ceiling = useDisposable(useMemo(() => {
    const material = new MeshStandardNodeMaterial({
      envMapIntensity: 0.7,
      metalness: 0,
      roughness: 0.9,
    })
    const finish = mix(texture(plaster).rgb, color('#381b1d'), 0.82)
    material.colorNode = finish
    material.emissiveNode = finish.mul(0.18)
    return material
  }, [plaster]))
  return {
    ceiling,
    plaster,
    trim,
    velvet,
  }
}

/** The Arena’s floor: polished cream and Nero Marquina marble in a checkerboard, on the tile grid from `origin`, mirroring the room in heavy mode. Every floor in a plane of its own needs one of its own, holding its reflection target. */
export function useArenaMarble(origin: Point, tile: number, polish: ArenaPolish = faintPolish) {
  const {floorReflections} = useGraphicsModeValue(getGraphicsProfile)
  const {strength, grazingStrength} = polish
  return useDisposable(useMemo(() => new CheckeredMarbleFloorMaterial({
    dark: neroMarquina,
    directSpecular: 0.1,
    drift: true,
    grazingStrength,
    light: cremaMarfil,
    loss: 0,
    origin,
    reflections: floorReflections,
    roughness: 0,
    seed: 3,
    strength,
    tile,
  }), [floorReflections, grazingStrength, origin, strength, tile]))
}

/** The Arena’s floor over a rectangular floor plan: its marble on a dark slab, with the slab’s collider. */
export function ArenaFloor({center, origin, polish, size, tile}: {
  /** the middle of the floor plan, in world meters */
  center: Point
  /** a corner of the floor’s tile grid, in world meters */
  origin: Point
  /** how clearly the marble mirrors the room, faintly by default */
  polish?: ArenaPolish
  size: FloorSize
  /** edge length of the floor’s marble tiles */
  tile: number
}) {
  const [x, z] = center
  const [width, depth] = size
  const slab = useDisposable(useMemo(() => new RoundedBoxGeometry(width, 0.24, depth, 2, 0.035), [width, depth]))
  const marble = useArenaMarble(origin, tile, polish)
  const reflection = marble.reflectionTarget
  return <>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, 0.12, depth / 2]} position={[x, -0.12, z]} />
    </RigidBody>
    <mesh castShadow geometry={slab} name='arena-floor-slab' position={[x, -0.12, z]} receiveShadow>
      <meshStandardNodeMaterial color='#23201d' roughness={0.8} />
    </mesh>
    <mesh material={marble} name='arena-marble-floor' position={[x, 0.001, z]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <Branch if={reflection}><primitive object={reflection!} /></Branch>
    </mesh>
  </>
}

/**
 * The Arena’s shell around a rectangular floor plan, without lights: its marble on a dark slab, its velvet walls with black lacquered trim and its dark plaster ceiling, with colliders for the floor and the ceiling.
 */
export default function ArenaShell({center, floorOrigin, height, polish, size, surfaces, tile, walls}: ArenaShellProps) {
  const [x, z] = center
  const [width, depth] = size
  const ceiling = useDisposable(useMemo(() => new RoundedBoxGeometry(width, 0.18, depth, 2, 0.045), [width, depth]))
  return <>
    {walls.map(wall => <WallSurface key={wall.id} material={surfaces.trim} plaster={surfaces.plaster} surfaceMaterial={surfaces.velvet} surfaceRoom='vesper' wall={wall} />)}
    <ArenaFloor center={center} origin={floorOrigin} polish={polish} size={size} tile={tile} />
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, 0.09, depth / 2]} position={[x, height, z]} />
    </RigidBody>
    <mesh castShadow geometry={ceiling} material={surfaces.ceiling} name='arena-ceiling' position={[x, height, z]} receiveShadow />
  </>
}
