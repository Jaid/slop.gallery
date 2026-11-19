import type {Wall} from '#src/lib/gallery.ts'
import type {ComponentType} from 'react'
import type {Material, Texture} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {architectureGeometry} from '#src/lib/gallery/architecture.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import withOpeningReveals from '#src/lib/gallery/openingReveals.ts'

/** what a world draws on one of its walls beyond the wall itself, like an entrance surround */
export type WallDecorationsProps = {
  material?: Material
  /** the color the wall’s trim takes without a material of its own */
  trim: string
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
  plaster: Texture
  /** what lines the wall’s openings instead of `surfaceMaterial`, which it then needs */
  revealMaterial?: Material
  surfaceMaterial?: Material
  surfaceRoom?: Wall['room']
  wall: Wall
}) {
  const colors: Partial<Record<Wall['room'], string>> = {
    moonfall: moonfallTheme.wall,
    oculus: '#4b5559',
    vesper: '#658578',
    antechamber: '#ded4b8',
    salon: '#8e2f24',
  }
  const color = colors[surfaceRoom] ?? '#eee7d7'
  const trims: Partial<Record<Wall['room'], string>> = {
    moonfall: moonfallTheme.trim,
    oculus: '#303d42',
    vesper: '#44655a',
    // ivory stucco, as the baseboards and cornices of Pompeii’s red rooms were
    salon: '#e3d9c4',
  }
  const trim = trims[surfaceRoom] ?? '#ded5c1'
  const geometry = architectureGeometry(wall)
  const surface = useDisposable(useMemo(() => {
    let lined = revealMaterial ? withOpeningReveals(geometry.surface, wall) : undefined
    // A wall without openings has nothing to line, and an empty group would draw nothing at the cost of a draw call.
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
        <Branch not={glass}><meshStandardNodeMaterial color='#b7d8d9' depthWrite={false} metalness={0.1} opacity={0.16} roughness={0.16} transparent /></Branch>
      </mesh>)}
    </RigidBody>
    {geometry.cornice.map((part, i) => <mesh key={i} castShadow geometry={part} material={material} name={`cornice-${wall.id}`} receiveShadow><Branch not={material}><meshStandardNodeMaterial color={trim} roughness={0.6} /></Branch></mesh>)}
    <Decorations material={material} trim={trim} wall={wall} />
  </group>
}
