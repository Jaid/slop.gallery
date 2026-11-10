import type {Material} from 'three/webgpu'

import {CoefficientCombineRule} from '@dimforge/rapier3d-compat'
import {RigidBody, TrimeshCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'
import useGraphicsMode from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import PendantLamps from '#component/PendantLamps'
import MarbleFountainWaterMaterial from '#src/fountains/marble/MarbleFountainWaterMaterial.ts'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {vaultShellThickness, wallFace} from '#src/lib/gallery/architectureDimensions.ts'
import {cistern, cisternDomeRibs, cisternInflow, cisternLantern} from '#src/lib/gallery/cistern/cistern.ts'
import CisternGeometry, {cisternWindowGeometry} from '#src/lib/gallery/cistern/CisternGeometry.ts'
import DrainGeometry from '#src/lib/gallery/cistern/DrainGeometry.ts'
import HalfDomeGeometry from '#src/lib/gallery/cistern/HalfDomeGeometry.ts'
import InflowGeometry from '#src/lib/gallery/cistern/InflowGeometry.ts'
import {routeRibDepth, routeRibThickness} from '#src/lib/gallery/passages/RoutedPassage.ts'
import {passageLantern, passageLanternGlow} from '#src/lib/gallery/pendants/passageLantern.ts'
import CisternWaterMaterial from '#src/lib/materials/CisternWaterMaterial.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'

const mounts = [cisternLantern]

/**
 * The Bastion’s cistern behind the Forge’s vestibule: its floor with the channel sunk into it, the inflow’s pipe pouring water into it and the water running along it, the half dome with its ribs and its lantern, the window’s reveal, and the drain in the approach’s floor that the channel’s water spills into out of the culvert.
 * The channel’s water swallows any bounce: an orb the cannon shoots in comes down into the channel and rides it round and out through the culvert.
 */
export default function BastionCistern({stone}: {stone: Material}) {
  const isHeavy = useGraphicsMode()
  const parts = useDisposable(useMemo(() => new CisternGeometry, []))
  const dome = useDisposable(useMemo(() => new HalfDomeGeometry({
    center: cistern.center,
    radius: cistern.radius - wallFace,
    spring: cistern.spring,
    rise: cistern.rise,
  }, {
    ribs: cisternDomeRibs,
    ribSection: [routeRibDepth, routeRibThickness],
    thickness: vaultShellThickness,
  }), []))
  const drain = useDisposable(useMemo(() => new DrainGeometry, []))
  const inflow = useDisposable(useMemo(() => new InflowGeometry, []))
  const reveal = useDisposable(useMemo(cisternWindowGeometry, []))
  const collision = useMemo(() => ({
    floor: colliderGeometry(parts.floor),
    channel: colliderGeometry(parts.channelCollision),
    dome: colliderGeometry(dome.surface),
    inflow: colliderGeometry(inflow.collision),
    reveal: colliderGeometry(reveal),
  }), [dome, inflow, parts, reveal])
  // The apse’s wrought iron.
  const iron = useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial({
    color: '#2a2724',
    metalness: 0.75,
    roughness: 0.5,
    envMapIntensity: 0.3,
  })), []))
  const water = useDisposable(useMemo(() => lightIndoors(new CisternWaterMaterial(cisternInflow.along)), []))
  const sump = useDisposable(useMemo(() => lightIndoors(new CisternWaterMaterial), []))
  const falling = useDisposable(useMemo(() => lightIndoors(new MarbleFountainWaterMaterial(true, isHeavy)), [isHeavy]))
  const dead = {
    restitution: 0,
    restitutionCombineRule: CoefficientCombineRule.Min,
  }
  return <group name='bastion-cistern'>
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision.floor} />
      {/* Its water swallows whatever drops into it. */}
      <MeshSurfaceCollider args={collision.channel} {...dead} />
      <TrimeshCollider args={collision.dome} />
      <TrimeshCollider args={collision.inflow} />
      <TrimeshCollider args={collision.reveal} />
      <mesh geometry={parts.floor} material={stone} name='cistern-floor' receiveShadow />
      <mesh castShadow geometry={parts.channel} material={stone} name='cistern-channel' receiveShadow />
      <mesh castShadow geometry={dome.shell} material={stone} name='cistern-dome' receiveShadow />
      <mesh castShadow geometry={dome.ribs} material={stone} name='cistern-dome-ribs' receiveShadow />
      <mesh castShadow geometry={reveal} material={stone} name='cistern-window-reveal' receiveShadow />
      <mesh castShadow geometry={inflow.pipe} material={iron} name='cistern-inflow' receiveShadow />
    </RigidBody>
    <mesh geometry={parts.water} material={water} name='cistern-water' receiveShadow />
    <mesh geometry={parts.falling} material={falling} name='cistern-falling-water' />
    {/* Only for the eye: the approach’s paving runs on under it for whatever rolls out of the culvert. */}
    <group name='cistern-drain'>
      <mesh geometry={drain.sump} material={stone} name='cistern-drain-sump' receiveShadow />
      <mesh geometry={drain.water} material={sump} name='cistern-drain-water' />
      <mesh castShadow geometry={drain.grate} material={iron} name='cistern-drain-grate' receiveShadow />
    </group>
    <PendantLamps body={passageLantern} glow={passageLanternGlow} mounts={mounts} name='cistern-pendants' />
  </group>
}
