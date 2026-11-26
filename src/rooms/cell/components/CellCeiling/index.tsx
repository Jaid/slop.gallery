import type {Material} from 'three/webgpu'

import {CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'

import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'
import CellCeilingGeometry, {cellCeilingSlab, cellOculus, cellRidge} from '#src/lib/gallery/CellCeilingGeometry.ts'
import ArchitecturalPlasterMaterial from '#src/lib/materials/ArchitecturalPlasterMaterial.ts'
import BrassMaterial from '#src/lib/materials/BrassMaterial.ts'
import ClearGlassMaterial from '#src/lib/materials/ClearGlassMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import JoineryWoodMaterial from '#src/lib/materials/JoineryWoodMaterial.ts'
import {isHeavyGraphics} from '#src/lib/rendering/graphicsQuality.ts'
import sandbox from '#src/worlds/sandbox/cell.ts'

const cell = sandbox.room('cell')
const {layout} = cell.room
const {vestibule} = layout
const [width] = layout.size
/** how high the middle of the round windows in the gables stands */
const oculusY = layout.height + cellOculus.rise

/**
 * The Cell’s ceilings: the hall’s gabled one, coffered up both slopes between walnut purlins and rafters, its fields framed by gilt fillets and all but the outer ones glazed as roof lights, under a walnut ridge beam with the brass plate the chandelier hangs from, its gables in walnut and pierced by round windows, and the round room’s level one in the same plaster with a gilt ring, with colliders under their slabs, across the windows, the beams and the gables.
 */
export default function CellCeiling({beams}: {
  /** the wood of the beams and the roof lights’ sashes, its grain along each mesh’s x axis */
  beams: Material
}) {
  const geometry = useDisposable(useMemo(() => new CellCeilingGeometry(layout), []))
  const collision = useMemo(() => ({
    beams: colliderGeometry(geometry.beams),
    crossBeams: colliderGeometry(geometry.crossBeams),
    gables: colliderGeometry(geometry.gables),
  }), [geometry])
  // A warm, tawny plaster between the beams and over the round room alike.
  const plaster = useDisposable(useMemo(() => new ArchitecturalPlasterMaterial({
    baseColor: hsl.integer(58, 36, 42),
    heavy: isHeavyGraphics,
    roughness: 0.88,
  }), []))
  const brass = useDisposable(useMemo(() => new BrassMaterial, []))
  // The beams’ walnut, its grain running level along the gables, from the hall’s north wall to its south wall.
  const gableWood = useDisposable(useMemo(() => new JoineryWoodMaterial({grain: 'z'}), []))
  const glass = useDisposable(useMemo(() => {
    const material = new ClearGlassMaterial({
      name: 'cell-skylight-glass',
      ior: 1.52,
      absorption: 0.04,
      clearcoat: 0.3,
    })
    // Its depth ends the moonlight’s shafts at the panes; marching on through the moonlit air over the roof, they would veil the stars in every light.
    material.depthWrite = true
    return material
  }, []))
  return <group name='cell-ceiling' position={cell.toWorld([0, 0, 0])}>
    {geometry.slopes.map(({position, rotation}, index) => <group key={index} name={`cell-ceiling-slope-${index}`} position={position} rotation={rotation}>
      {/* The slab’s collider runs on across the roof lights. */}
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[width / 2, cellCeilingSlab / 2, geometry.length / 2]} position={[0, cellCeilingSlab / 2, 0]} />
        <TrimeshCollider args={collision.beams} />
        <group rotation={[0, Math.PI / 2, 0]}>
          <TrimeshCollider args={collision.crossBeams} />
        </group>
      </RigidBody>
      <mesh castShadow geometry={geometry.slab} material={plaster} name='cell-ceiling-hall' receiveShadow />
      <mesh castShadow geometry={geometry.beams} material={beams} name='cell-ceiling-beams' receiveShadow />
      <mesh castShadow geometry={geometry.crossBeams} material={beams} name='cell-ceiling-cross-beams' receiveShadow rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geometry.gilt} material={gold} name='cell-ceiling-gilt' receiveShadow />
      <mesh castShadow geometry={geometry.sash} material={beams} name='cell-skylight-sash' receiveShadow />
      <mesh castShadow geometry={geometry.sashStiles} material={beams} name='cell-skylight-sash-stiles' receiveShadow rotation={[0, Math.PI / 2, 0]} />
      {/* Letting the moon through. */}
      <mesh geometry={geometry.glass} material={glass} name='cell-skylight-glass' />
    </group>)}
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, cellRidge.depth / 2, cellRidge.width / 2]} position={[0, layout.ridgeHeight - cellCeilingSlab / 2 - cellRidge.depth / 2, 0]} />
      <TrimeshCollider args={collision.gables} />
      {[-1, 1].map(side => <CylinderCollider key={side} args={[wallFace / 2, cellOculus.radius + 0.01]} position={[side * (width / 2 - wallFace / 2), oculusY, 0]} rotation={[0, 0, Math.PI / 2]} />)}
      {vestibule && <CylinderCollider args={[cellCeilingSlab / 2, vestibule.radius]} position={[vestibule.center[0], layout.roundHeight, vestibule.center[1]]} />}
    </RigidBody>
    <mesh castShadow geometry={geometry.ridge} material={beams} name='cell-ceiling-ridge' receiveShadow />
    <mesh castShadow geometry={geometry.plate} material={brass} name='cell-chandelier-plate' receiveShadow />
    <mesh castShadow geometry={geometry.gables} material={gableWood} name='cell-gables' receiveShadow />
    <mesh castShadow geometry={geometry.oculi} material={beams} name='cell-oculi' receiveShadow rotation={[0, Math.PI / 2, 0]} />
    <mesh geometry={geometry.oculusGilt} material={gold} name='cell-oculus-gilt' receiveShadow />
    <mesh geometry={geometry.oculusGlass} material={glass} name='cell-oculus-glass' />
    <Branch if={vestibule}>
      <>
        <mesh castShadow geometry={geometry.rounds} material={plaster} name='cell-ceiling-rounds' receiveShadow />
        <mesh geometry={geometry.roundGilt} material={gold} name='cell-ceiling-round-gilt' receiveShadow />
      </>
    </Branch>
  </group>
}
