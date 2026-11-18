import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import VesperBridgeGeometry, {vesperBridgeCollision} from '#src/lib/gallery/VesperBridgeGeometry.ts'
import vesperCeiling from '#src/lib/gallery/vesperCeiling.ts'
import VesperCeilingGeometry, {vesperCeilingCollision} from '#src/lib/gallery/VesperCeilingGeometry.ts'
import ArchitecturalPlasterMaterial from '#src/lib/materials/ArchitecturalPlasterMaterial.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

/**
 * The Vesper’s coved ceiling with its glazed lantern, which lights the room from the sky instead of lamps, and the bronze bridge that splits the lantern in two across its middle.
 * Rendered inside the room’s group, at its middle.
 */
export default function VesperCeiling({size}: {
  size: readonly [number, number]
}) {
  const isHeavy = useGraphicsMode()
  const {curveDetail} = useGraphicsModeValue(getGraphicsProfile)
  const geometry = useDisposable(useMemo(() => new VesperCeilingGeometry(size, curveDetail), [curveDetail, size]))
  const bridge = useDisposable(useMemo(() => new VesperBridgeGeometry(size, curveDetail), [curveDetail, size]))
  // Pale celadon plaster, so the daylight from the lantern carries across the coves down to the green walls.
  const plaster = useDisposable(useMemo(() => new ArchitecturalPlasterMaterial({
    baseColor: '#b9c9b6',
    heavy: isHeavy,
    roughness: 0.86,
  }), [isHeavy]))
  // Water gilt like the Lobby vault’s, which keeps a little body color instead of mirroring the shaded coves.
  const gilt = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#d3a554',
    metalness: 0.55,
    roughness: 0.34,
  }), []))
  // Painted bronze glazing bars, as on the Lobby vault and the Salon’s skylight.
  const bronze = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#5b4a35',
    metalness: 0.5,
    roughness: 0.5,
  }), []))
  // The Lobby vault’s cast glass, divided into the same panes as the bars in front of it.
  const glass = useDisposable(useMemo(() => new VaultGlassMaterial({
    heavy: isHeavy,
    paneSize: [vesperCeiling.lantern.pane, vesperCeiling.lantern.pane],
  }), [isHeavy]))
  const collision = useMemo(() => vesperCeilingCollision(size), [size])
  const bridgeCollision = useMemo(() => vesperBridgeCollision(size), [size])
  return <group name='vesper-ceiling'>
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision} />
      <MeshSurfaceCollider args={bridgeCollision} />
    </RigidBody>
    <mesh castShadow geometry={geometry.plaster} material={plaster} name='vesper-ceiling-plaster' receiveShadow />
    <mesh castShadow geometry={geometry.gilt} material={gilt} name='vesper-ceiling-gilding' receiveShadow />
    <mesh castShadow geometry={geometry.bars} material={bronze} name='vesper-lantern-bars' />
    {/* The glass lets the sun through: it casts no shadow, only its bars do. */}
    <mesh castShadow={false} geometry={geometry.glass} material={glass} name='vesper-lantern-glass' />
    <group name='vesper-bridge'>
      <mesh castShadow geometry={bridge.bronze} material={bronze} name='vesper-bridge-bronze' receiveShadow />
      <mesh castShadow geometry={bridge.gilt} material={gilt} name='vesper-bridge-gilding' receiveShadow />
    </group>
  </group>
}
