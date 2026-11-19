import type {Material} from 'three/webgpu'

import {CuboidCollider, CylinderCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {DoubleSide, MeshStandardNodeMaterial, Vector2} from 'three/webgpu'
import useGraphicsMode from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {forgeCupola} from '#src/lib/gallery/forgeRoof.ts'
import ForgeRoofGeometry, {ForgeCupolaGeometry, forgePaneSize} from '#src/lib/gallery/ForgeRoofGeometry.ts'
import ForgeOpalMaterial from '#src/lib/materials/forge/ForgeOpalMaterial.ts'
import {ForgeCupolaMaterial, ForgeDeckMaterial} from '#src/lib/materials/forge/ForgeRoofMaterials.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'

/** Three glazed sawteeth on riveted bowstring trusses. The panes pass sunlight but stop loose objects. */
export default function ForgeRoof({masonry}: {masonry: Material}) {
  const heavy = useGraphicsMode()
  const geometry = useDisposable(useMemo(() => new ForgeRoofGeometry, []))
  const decking = useDisposable(useMemo(() => new ForgeDeckMaterial, []))
  const glass = useDisposable(useMemo(() => {
    const material = new VaultGlassMaterial({
      heavy,
      paneSize: forgePaneSize,
    })
    material.side = DoubleSide
    material.forceSinglePass = true
    return material
  }, [heavy]))
  const {iron, copper} = useRoofMetals()
  return <group name='forge-roof'>
    <RigidBody colliders={false} type='fixed'><MeshSurfaceCollider args={geometry.collision} /></RigidBody>
    <mesh castShadow geometry={geometry.decking} material={decking} name='forge-roof-decking' receiveShadow />
    <mesh castShadow geometry={geometry.masonry} material={masonry} name='forge-roof-gables' receiveShadow />
    <mesh castShadow geometry={geometry.iron} material={iron} name='forge-roof-trusses' receiveShadow />
    <mesh castShadow geometry={geometry.copper} material={copper} name='forge-roof-rivets' receiveShadow />
    <mesh geometry={geometry.glass} material={glass} name='forge-roof-clerestories' />
  </group>
}

/** The vestibule’s brick cap and its suspended copper-and-opal pendant. */
export function ForgeCupola() {
  const geometry = useDisposable(useMemo(() => new ForgeCupolaGeometry, []))
  const masonry = useDisposable(useMemo(() => new ForgeCupolaMaterial, []))
  const {iron, copper} = useRoofMetals()
  return <group name='forge-vestibule-cupola'>
    <RigidBody colliders={false} type='fixed'><MeshSurfaceCollider args={geometry.collision} /></RigidBody>
    <mesh castShadow geometry={geometry.masonry} material={masonry} name='forge-cupola-brick' receiveShadow />
    <mesh castShadow geometry={geometry.iron} material={iron} name='forge-cupola-ribs' receiveShadow />
    <mesh castShadow geometry={geometry.copper} material={copper} name='forge-cupola-copper' receiveShadow />
    <Pendant copper={copper} iron={iron} />
  </group>
}

function useRoofMetals() {
  return useDisposable(useMemo(() => {
    const iron = new MeshStandardNodeMaterial({
      color: '#303c40',
      metalness: 0.45,
      roughness: 0.58,
    })
    iron.name = 'Forge painted iron'
    const copper = new MeshStandardNodeMaterial({
      color: '#b2774f',
      metalness: 0.6,
      roughness: 0.45,
    })
    copper.name = 'Forge brushed copper'
    return {iron, copper, dispose() {
      iron.dispose()
      copper.dispose()
    }}
  }, []))
}
const shade = [[0, 0.34], [0.15, 0.34], [0.15, 0.27], [0.22, 0.23], [0.4, 0.18], [0.56, 0.08], [0.64, 0.069], [0.65, 0.045], [0.635, 0.023], [0.59, 0.023], [0.52, 0.055], [0.13, 0.27], [0, 0.27]].toReversed().map(([r, y]) => new Vector2(r, y))
const globe = [[0, -0.23], [0.13, -0.224], [0.3, -0.195], [0.44, -0.145], [0.52, -0.065], [0.55, 0.052], [0, 0.052]].map(([r, y]) => new Vector2(r, y))
function Pendant({copper, iron}: {
  copper: Material
  iron: Material
}) {
  const opal = useDisposable(useMemo(() => new ForgeOpalMaterial('forge-cupola'), []))
  const shadeY = forgeCupola.lampY + 0.25
  const stem = forgeCupola.crownY - shadeY - 0.35
  return <group name='forge-cupola-pendant' position={[0, shadeY, 0]}>
    <RigidBody colliders={false} type='fixed'>
      <CylinderCollider args={[0.145, 0.56]} position={[0, -0.085, 0]} />
      <CylinderCollider args={[stem / 2, 0.027]} position={[0, 0.3 + stem / 2, 0]} />
      <CylinderCollider args={[0.028, 0.65]} position={[0, 0.045, 0]} />
      <CuboidCollider args={[0.28, 0.08, 0.28]} position={[0, 0.18, 0]} />
    </RigidBody>
    <StaticBatch name='forge-pendant-metalwork'>
      <mesh castShadow material={iron} position={[0, 0.3 + stem / 2, 0]} receiveShadow><cylinderGeometry args={[0.027, 0.027, stem, 16]} /></mesh>
      {/* The diffuser is an area source; do not let the shade hard-mask its entire uplight. */}
      <mesh material={copper} receiveShadow><latheGeometry args={[shade, 64]} /></mesh>
      {[0.92, 1.05].map(y => <mesh key={y} castShadow material={copper} position={[0, y, 0]} receiveShadow><cylinderGeometry args={[0.047, 0.047, 0.037, 16]} /></mesh>)}
    </StaticBatch>
    <mesh material={opal} name='forge-pendant-opal'><latheGeometry args={[globe, 64]} /></mesh>
  </group>
}
