import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import VesperBridgeGeometry from '#src/lib/gallery/VesperBridgeGeometry.ts'
import vesperCeiling from '#src/lib/gallery/vesperCeiling.ts'
import VesperCeilingGeometry, {vesperCeilingCollision} from '#src/lib/gallery/VesperCeilingGeometry.ts'
import ArchitecturalPlasterMaterial from '#src/lib/materials/ArchitecturalPlasterMaterial.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

/**
 * The Vesper’s coved ceiling and glazed lantern, divided by a bridge but still lit from the sky instead of lamps.
 * Rendered inside the room’s group, at its middle.
 */
export default function VesperCeiling({size}: {
  size: readonly [number, number]
}) {
  const isHeavy = useGraphicsMode()
  const {curveDetail} = useGraphicsModeValue(getGraphicsProfile)
  const geometry = useDisposable(useMemo(() => new VesperCeilingGeometry(size, curveDetail), [curveDetail, size]))
  const bridge = useDisposable(useMemo(() => new VesperBridgeGeometry(size), [size]))
  // Pale celadon plaster, so the daylight from the lantern carries across the coves down to the green walls.
  const plaster = useDisposable(useMemo(() => new ArchitecturalPlasterMaterial({
    baseColor: '#b9c9b6',
    heavy: isHeavy,
    roughness: 0.86,
  }), [isHeavy]))
  const limestone = useDisposable(useMemo(() => new ArchitecturalPlasterMaterial({
    baseColor: '#c3b99e',
    heavy: isHeavy,
    roughness: 0.84,
  }), [isHeavy]))
  const patinatedBronze = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#41574d',
    metalness: 0.48,
    roughness: 0.43,
  }), []))
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
  return <group name='vesper-ceiling'>
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision} />
      <MeshSurfaceCollider args={bridge.collision} />
    </RigidBody>
    <mesh castShadow geometry={geometry.plaster} material={plaster} name='vesper-ceiling-plaster' receiveShadow />
    <mesh castShadow geometry={geometry.gilt} material={gilt} name='vesper-ceiling-gilding' receiveShadow />
    <mesh castShadow geometry={geometry.bars} material={bronze} name='vesper-lantern-bars' />
    <group name='vesper-lantern-bridge'>
      <mesh castShadow geometry={bridge.deck} material={limestone} name='vesper-bridge-arch' receiveShadow />
      <mesh castShadow geometry={bridge.bronze} material={patinatedBronze} name='vesper-bridge-bronze' receiveShadow />
      <mesh castShadow geometry={bridge.gilt} material={gilt} name='vesper-bridge-gilding' receiveShadow />
    </group>
    {/* The glass lets the sun through: it casts no shadow, unlike the glazing bars and the bridge. */}
    <mesh castShadow={false} geometry={geometry.glass} material={glass} name='vesper-lantern-glass' />
  </group>
}
