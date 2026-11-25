import type {Wall} from '#src/lib/gallery.ts'
import type {ComponentType} from 'react'
import type {ColorRepresentation, Material, Texture} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {architectureGeometry} from '#src/lib/gallery/architecture.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import withOpeningReveals from '#src/lib/gallery/openingReveals.ts'

/** what a world draws on one of its walls beyond the wall itself, like an entrance surround */
export type WallDecorationsProps = {
  material?: Material
  /** the color the wall’s trim takes without a material of its own */
  trim: ColorRepresentation
  wall: Wall
}

/** draws nothing on a wall */
const noDecorations = () => null

/**
 * A wall with its trim, glazing and colliders, welded, so whatever rolls along its foot, like an orb along a baseboard, rolls on smoothly instead of catching on the edges between its facets. Its surface mesh carries the wall as `userData.wall`, so a material shared by many walls can lay its pattern out along each, round ones too.
 */
export default function WallSurface({wall, plaster, glass, material, revealMaterial, surfaceMaterial, surfaceRoom = wall.room, decorations: Decorations = noDecorations}: {
  /** what the world draws on the wall beyond the wall itself, nothing by default */
  decorations?: ComponentType<WallDecorationsProps>
  glass?: Material
  material?: Material
  /** the plaster of a wall without a `surfaceMaterial` */
  plaster?: Texture
  /** what lines the wall’s openings instead of `surfaceMaterial`, which it then needs */
  revealMaterial?: Material
  surfaceMaterial?: Material
  surfaceRoom?: Wall['room']
  wall: Wall
}) {
  const colors: Partial<Record<Wall['room'], ColorRepresentation>> = {
    moonfall: moonfallTheme.wall,
    oculus: hsl.integer(224, 9, 36),
    vesper: hsl.integer(168, 25, 52),
    antechamber: hsl.integer(91, 33, 85),
    salon: hsl.integer(30, 80, 36),
  }
  const color = colors[surfaceRoom] ?? hsl.integer(87, 34, 92)
  const trims: Partial<Record<Wall['room'], ColorRepresentation>> = {
    moonfall: moonfallTheme.trim,
    oculus: hsl.integer(223, 17, 25),
    vesper: hsl.integer(172, 32, 40),
    // ivory stucco, as the baseboards and cornices of Pompeii’s red rooms were
    salon: hsl.integer(86, 30, 87),
  }
  const trim = trims[surfaceRoom] ?? hsl.integer(87, 26, 85)
  const geometry = architectureGeometry(wall)
  const surface = useDisposable(useMemo(() => {
    let lined = revealMaterial ? withOpeningReveals(geometry.surface, wall) : undefined
    // A wall without openings has nothing to line, and its empty group would cost a draw call for nothing.
    if (lined?.groups[1].count === 0) {
      lined.dispose()
      lined = undefined
    }
    return {
      geometry: lined ?? geometry.surface,
      lined: Boolean(lined),
      // The plain surface is shared through the architecture’s cache.
      dispose: () => lined?.dispose(),
    }
  }, [geometry.surface, revealMaterial, wall]))
  const surfaceMaterials = surface.lined && revealMaterial && surfaceMaterial ? [surfaceMaterial, revealMaterial] : surfaceMaterial ?? material
  return <group
    name={wall.id} position={wall.center} rotation={[0, wall.rotation, 0]} userData={{
      wallId: wall.id,
      room: wall.room,
    }}
  >
    <RigidBody colliders={false} type='fixed'>
      {geometry.collision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
      <mesh castShadow material={surfaceMaterials} name={`wall-${wall.id}`} receiveShadow userData={{wall}}><primitive attach='geometry' object={surface.geometry} /><Branch not={surfaceMaterials}><meshStandardNodeMaterial color={color} envMapIntensity={surfaceRoom === 'moonfall' ? 0.08 : 1} map={plaster} roughness={0.9} /></Branch></mesh>
      {geometry.trim.map((part, i) => <mesh key={i} castShadow material={material} name={`trim-${wall.id}`} receiveShadow><primitive attach='geometry' object={part} /><Branch not={material}><meshStandardNodeMaterial color={trim} roughness={0.6} /></Branch></mesh>)}
      {geometry.glazing.map((part, i) => <mesh key={i} geometry={part} material={glass} name={`glass-${wall.id}`}>
        <Branch not={glass}><meshStandardNodeMaterial color={hsl.integer(199, 30, 83.5)} depthWrite={false} metalness={0.1} opacity={0.16} roughness={0.16} transparent /></Branch>
      </mesh>)}
    </RigidBody>
    {geometry.cornice.map((part, i) => <mesh key={i} castShadow geometry={part} material={material} name={`cornice-${wall.id}`} receiveShadow><Branch not={material}><meshStandardNodeMaterial color={trim} roughness={0.6} /></Branch></mesh>)}
    <Decorations material={material} trim={trim} wall={wall} />
  </group>
}
