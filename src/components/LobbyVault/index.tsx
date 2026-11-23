import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {lobbyBalcony} from '#src/lib/gallery/lobbyBalcony.ts'
import LobbyChandelierGeometry from '#src/lib/gallery/LobbyChandelierGeometry.ts'
import lobbyVault, {lobbyChandeliers} from '#src/lib/gallery/lobbyVault.ts'
import LobbyVaultGeometry, {lobbyVaultCollision} from '#src/lib/gallery/LobbyVaultGeometry.ts'
import ArchitecturalPlasterMaterial from '#src/lib/materials/ArchitecturalPlasterMaterial.ts'
import CandleFlameMaterial from '#src/lib/materials/CandleFlameMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import LimestoneMaterial from '#src/lib/materials/LimestoneMaterial.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

/**
 * The Lobby’s coffered barrel vault with its glazed crown and rose windows, and the great chandeliers hanging from it.
 * Rendered inside the room’s group, at its center. `cladding` is the walls’ own travertine, carried on up the lunettes.
 */
export default function LobbyVault({cladding}: {
  cladding: Material
}) {
  const isHeavy = useGraphicsMode()
  const {curveDetail} = useGraphicsModeValue(getGraphicsProfile)
  const geometry = useDisposable(useMemo(() => new LobbyVaultGeometry(curveDetail), [curveDetail]))
  const stone = useDisposable(useMemo(() => new LimestoneMaterial, []))
  // Cream coffer fields behind the white stone frames, gilt moldings and rosettes.
  const plaster = useDisposable(useMemo(() => new ArchitecturalPlasterMaterial({
    baseColor: '#ece7d9',
    heavy: isHeavy,
    roughness: 0.86,
  }), [isHeavy]))
  // Painted bronze glazing bars, as on the Vesper’s and the Salon’s lanterns.
  const bars = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#5b4a35',
    metalness: 0.5,
    roughness: 0.5,
  }), []))
  // Water-gilt ornament: on the vault, polished metal would mirror the dark coffers around it and turn black, so the leaf keeps a
  // little body color and catches the room’s own light.
  const gilt = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#d3a554',
    metalness: 0.55,
    roughness: 0.34,
  }), []))
  // Cast conservatory glass like the floor’s, divided into the same panes as the bars in front of it.
  const glass = useDisposable(useMemo(() => new VaultGlassMaterial({
    heavy: isHeavy,
    paneSize: [lobbyVault.glazing.pane, lobbyVault.glazing.pane],
  }), [isHeavy]))
  const collision = useMemo(lobbyVaultCollision, [])
  return <group name='lobby-vault'>
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision} />
      {[[-1, lobbyVault.rose.lunetteThickness, lobbyVault.springY], [1, lobbyVault.southLunetteThickness, lobbyBalcony.wallTop]].map(([side, thickness, foot]) => {
        const top = lobbyVault.springY + lobbyVault.outerRadius
        return <CuboidCollider key={side} args={[lobbyVault.outerRadius, (top - foot) / 2, thickness / 2]} position={[0, (top + foot) / 2, side * (lobbyVault.halfLength + thickness / 2)]} />
      })}
    </RigidBody>
    <mesh castShadow geometry={geometry.clad} material={cladding} name='lobby-vault-lunettes' receiveShadow />
    <mesh castShadow geometry={geometry.stone} material={stone} name='lobby-vault-stone' receiveShadow />
    <mesh castShadow geometry={geometry.plaster} material={plaster} name='lobby-vault-coffers' receiveShadow />
    <mesh castShadow geometry={geometry.gold} material={gilt} name='lobby-vault-gilding' receiveShadow />
    <mesh castShadow geometry={geometry.bars} material={bars} name='lobby-vault-glazing-bars' />
    {/* The glass lets the sun through: it casts no shadow, only its bars and tracery do. */}
    <mesh castShadow={false} geometry={geometry.glass} material={glass} name='lobby-vault-glass' />
    <mesh castShadow={false} geometry={geometry.roseGlass} material={glass} name='lobby-vault-rose-window' />
    <LobbyChandeliers />
  </group>
}

/**
 * The great chandeliers, each lighting its third of the Lobby through the lamp hung below its hub.
 */
function LobbyChandeliers() {
  const geometry = useDisposable(useMemo(() => new LobbyChandelierGeometry(lobbyChandeliers.anchorY - lobbyChandeliers.y), []))
  const candles = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#efe2c4',
    roughness: 0.6,
  }), []))
  const flames = useDisposable(useMemo(() => new CandleFlameMaterial, []))
  return <group name='lobby-chandeliers'>
    {lobbyChandeliers.offsets.map(z => <group key={z} name={`lobby-chandelier-${z}`} position={[0, lobbyChandeliers.y, z]}>
      <mesh geometry={geometry.gilt} material={gold} name='lobby-chandelier-gilt' />
      <mesh geometry={geometry.candles} material={candles} name='lobby-chandelier-candles' />
      <mesh geometry={geometry.flames} material={flames} name='lobby-chandelier-flames' renderOrder={1} />
    </group>)}
  </group>
}
