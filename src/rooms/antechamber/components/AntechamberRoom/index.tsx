import type {NodeMaterial} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {CircleGeometry, DoubleSide, MeshStandardNodeMaterial} from 'three/webgpu'
import {useGraphicsModeValue} from 'use-graphics-mode'

import AntechamberDome from '#component/AntechamberDome'
import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import RoomFloor from '#component/RoomFloor'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import antechamber, {antechamberEastFlight, antechamberEastLanding, antechamberEastRoof, antechamberNecks, antechamberPavilions} from '#src/lib/gallery/antechamber.ts'
import {centralCompassInlayGeometry, eastStairHandrailGeometry, neckBrassRibGeometry, neckVaultGeometry, pavilionCeilingSlabGeometry, pavilionDrumGeometry, pavilionFloorRingGeometry, pavilionLatticeGeometry} from '#src/lib/gallery/antechamberArchitecture.ts'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import StainedGlassMaterial from '#src/lib/materials/StainedGlassMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('antechamber')
const [originX, originZ] = antechamber.center
const [width, depth] = room.size
/** Jewel stained-glass palette for the flanking pavilions’ oculus skylights, harmonizing with the central starry dome. */
const pavilionGlassPalette = {
  border: '#2f9e5a',
  center: '#fff0b0',
  petals: ['#2b4fd8', '#ffb43c'],
} as const

/**
 * The Antechamber’s three-bay architecture: central starry domed hall with brass compass floor inlay, twin barrel-vaulted necks with brass arch ribs, twin flanking pavilions crowned by starry oculus skylights, and the ascending east stairs toward the future upper floor.
 */
export default function AntechamberRoom({glass, marmorino, stone, wood}: Omit<Parameters<typeof RoomFloor>[0], 'room'> & {
  marmorino: NodeMaterial
}) {
  const {mirrorReflections} = useGraphicsModeValue(getGraphicsProfile)
  const envMapIntensity = mirrorReflections ? 1 : 0
  const floorRoughness = mirrorReflections ? 0.36 : 0.8
  const resources = useDisposable(useMemo(() => {
    const neckVault = neckVaultGeometry()
    const neckVaultCollision = colliderGeometry(neckVault)
    const neckRib = neckBrassRibGeometry()
    const pavilionSlab = pavilionCeilingSlabGeometry()
    const pavilionDrum = pavilionDrumGeometry()
    const pavilionLattice = pavilionLatticeGeometry()
    const pavilionPane = new CircleGeometry(antechamber.pavilion.skylight.radius, 64)
    const centralCompass = centralCompassInlayGeometry()
    const pavilionRing = pavilionFloorRingGeometry()
    const handrails = ([-1, 1] as const).map(side => {
      const geometry = eastStairHandrailGeometry(side)
      return {
        side,
        geometry,
        collision: colliderGeometry(geometry),
      }
    })
    const brass = new MeshStandardNodeMaterial({
      color: '#cca462',
      metalness: 0.6,
      roughness: 0.34,
    })
    const inlayBrass = new MeshStandardNodeMaterial({
      color: '#a88c58',
      metalness: 0.45,
      roughness: 0.4,
    })
    const ceilingPlaster = new MeshStandardNodeMaterial({
      color: '#e1dccc',
      roughness: 0.7,
    })
    const drumBlue = new MeshStandardNodeMaterial({
      color: '#1f3785',
      roughness: 0.75,
    })
    const pavilionGlass = new StainedGlassMaterial(pavilionGlassPalette)
    return {
      neckVault,
      neckVaultCollision,
      neckRib,
      pavilionSlab,
      pavilionDrum,
      pavilionLattice,
      pavilionPane,
      centralCompass,
      pavilionRing,
      handrails,
      brass,
      inlayBrass,
      ceilingPlaster,
      drumBlue,
      pavilionGlass,
      dispose() {
        neckVault.dispose()
        neckRib.dispose()
        pavilionSlab.dispose()
        pavilionDrum.dispose()
        pavilionLattice.dispose()
        pavilionPane.dispose()
        centralCompass.dispose()
        pavilionRing.dispose()
        for (const rail of handrails) {
          rail.geometry.dispose()
        }
        brass.dispose()
        inlayBrass.dispose()
        ceilingPlaster.dispose()
        drumBlue.dispose()
        pavilionGlass.dispose()
      },
    }
  }, []))
  const {skylight} = antechamber.pavilion
  const [landingX, landingZ] = antechamberEastLanding.center
  const [landingLen, landingWidth] = antechamberEastLanding.size
  return <group name='antechamber-room' position={[room.center[0], 0, room.center[1]]}>
    {/* Central hall */}
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, 0.15, depth / 2]} position={[0, room.height + 0.1, 0]} />
    </RigidBody>
    <AntechamberDome height={room.height} size={room.size} />
    <RoomFloor glass={glass} room={room} stone={stone} wood={wood} />
    <mesh geometry={resources.centralCompass} material={resources.inlayBrass} name='antechamber-compass-inlay' position={[0, 0.014, 0]} receiveShadow />

    {/* Twin barrel-vaulted necks connecting central hall to west and east pavilions */}
    {antechamberNecks.map(({side, center: [nx, nz], size: [nLen, nWidth]}) => {
      const lx = nx - originX
      const lz = nz - originZ
      return <group key={side} name={`antechamber-${side}-neck`} position={[lx, 0, lz]}>
        <RigidBody colliders={false} type='fixed'>
          <CuboidCollider args={[nLen / 2, floorThickness / 2, nWidth / 2]} position={[0, -floorThickness / 2, 0]} />
          <Box color='#f3eddf' envMapIntensity={envMapIntensity} map={stone} name={`antechamber-${side}-neck-floor`} position={[0, -floorThickness / 2, 0]} roughness={floorRoughness} size={[nLen, floorThickness, nWidth]} />
          <group position={[0, antechamber.neck.springY, 0]}>
            <MeshSurfaceCollider args={resources.neckVaultCollision} />
          </group>
        </RigidBody>
        <mesh castShadow geometry={resources.neckVault} material={marmorino} name={`antechamber-${side}-neck-vault`} position={[0, antechamber.neck.springY, 0]} receiveShadow />
        <mesh castShadow geometry={resources.neckRib} material={resources.brass} name={`antechamber-${side}-neck-rib`} position={[0, antechamber.neck.springY, 0]} receiveShadow />
        {[-1, 1].map(edge => <Box key={edge} material={resources.inlayBrass} name={`antechamber-${side}-neck-inlay`} position={[0, 0.015, edge * (nWidth / 2 - 0.32)]} size={[nLen, 0.012, 0.026]} />)}
      </group>
    })}

    {/* Twin sunlit side pavilions, each with a starry oculus skylight and matching brass floor medallion */}
    {antechamberPavilions.map(({side, center: [px, pz], size: [pWidth, pDepth], height: pHeight}) => {
      const lx = px - originX
      const lz = pz - originZ
      const springY = pHeight + 0.07
      const latticeY = springY + skylight.drumHeight - skylight.latticeDepth
      return <group key={side} name={`antechamber-${side}-pavilion`} position={[lx, 0, lz]}>
        <RigidBody colliders={false} type='fixed'>
          <CuboidCollider args={[pWidth / 2, floorThickness / 2, pDepth / 2]} position={[0, -floorThickness / 2, 0]} />
          <CuboidCollider args={[pWidth / 2, 0.15, pDepth / 2]} position={[0, pHeight + 0.1, 0]} />
          <Box color='#f3eddf' envMapIntensity={envMapIntensity} map={stone} name={`antechamber-${side}-pavilion-floor`} position={[0, -floorThickness / 2, 0]} roughness={floorRoughness} size={[pWidth, floorThickness, pDepth]} />
        </RigidBody>
        {/* Floor inlays: outer brass rectangle + circular medallion mirroring the oculus above */}
        {[-1, 1].map(edge => <group key={edge}>
          <Box material={resources.inlayBrass} name={`antechamber-${side}-pavilion-inlay`} position={[edge * (pWidth / 2 - 0.9), 0.015, 0]} size={[0.026, 0.012, pDepth - 1.8]} />
          <Box material={resources.inlayBrass} name={`antechamber-${side}-pavilion-inlay`} position={[0, 0.015, edge * (pDepth / 2 - 0.9)]} size={[pWidth - 1.8, 0.012, 0.026]} />
        </group>)}
        <mesh geometry={resources.pavilionRing} material={resources.inlayBrass} name={`antechamber-${side}-pavilion-ring`} position={[0, 0.014, 0]} receiveShadow />
        {/* Pierced ceiling slab, ultramarine drum, brass collar rings, star lattice and stained-glass roundel */}
        <mesh castShadow geometry={resources.pavilionSlab} material={resources.ceilingPlaster} name={`antechamber-${side}-pavilion-ceiling`} position={[0, pHeight - 0.11, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]} />
        <mesh castShadow geometry={resources.pavilionDrum} material={resources.drumBlue} name={`antechamber-${side}-pavilion-drum`} position={[0, springY, 0]} receiveShadow />
        <mesh castShadow material={resources.brass} name={`antechamber-${side}-pavilion-ring-lower`} position={[0, pHeight - 0.04, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[skylight.radius, 0.055, 12, 96]} />
        </mesh>
        <mesh castShadow material={resources.brass} name={`antechamber-${side}-pavilion-ring-mid`} position={[0, springY + skylight.drumHeight * 0.45, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[skylight.radius, 0.028, 10, 96]} />
        </mesh>
        <mesh castShadow material={resources.brass} name={`antechamber-${side}-pavilion-ring-upper`} position={[0, latticeY, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[skylight.radius, 0.038, 10, 96]} />
        </mesh>
        <mesh castShadow geometry={resources.pavilionLattice} name={`antechamber-${side}-pavilion-lattice`} position={[0, latticeY, 0]} receiveShadow>
          <meshStandardNodeMaterial color='#cca462' metalness={0.6} roughness={0.34} side={DoubleSide} />
        </mesh>
        <mesh castShadow geometry={resources.pavilionPane} material={resources.pavilionGlass} name={`antechamber-${side}-pavilion-glass`} position={[0, latticeY + skylight.latticeDepth + 0.005, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    })}

    {/* Ascending east staircase toward the future upper floor, closed by a blank wall at its top landing */}
    <StaticBatch name='antechamber-east-stairs'>
      <RigidBody colliders={false} type='fixed'>
        {antechamberEastFlight.blocks.map(({position, size: blockSize}, i) => {
          const localPos = [position[0] - originX, position[1], position[2] - originZ] as const
          return <group key={i}>
            <CuboidCollider args={[blockSize[0] / 2, blockSize[1] / 2, blockSize[2] / 2]} position={localPos} />
            <Box color='#f3eddf' envMapIntensity={envMapIntensity} map={stone} name={`antechamber-east-step-${i}`} position={localPos} roughness={floorRoughness} size={blockSize} />
          </group>
        })}
        {/* Top landing floor & ceiling slabs */}
        <CuboidCollider args={[landingLen / 2, floorThickness / 2, landingWidth / 2]} position={[landingX - originX, antechamberEastLanding.floorY - floorThickness / 2, landingZ - originZ]} />
        <Box color='#f3eddf' envMapIntensity={envMapIntensity} map={stone} name='antechamber-east-landing-floor' position={[landingX - originX, antechamberEastLanding.floorY - floorThickness / 2, landingZ - originZ]} roughness={floorRoughness} size={[landingLen, floorThickness, landingWidth]} />
        <CuboidCollider args={[landingLen / 2, 0.09, landingWidth / 2]} position={[landingX - originX, antechamberEastLanding.floorY + antechamberEastLanding.height + 0.09, landingZ - originZ]} />
        <Box material={resources.ceilingPlaster} name='antechamber-east-landing-ceiling' position={[landingX - originX, antechamberEastLanding.floorY + antechamberEastLanding.height + 0.09, landingZ - originZ]} size={[landingLen, 0.18, landingWidth]} />
        {/* Sloped ceiling over the ascending flight */}
        <CuboidCollider args={[antechamberEastRoof.size[0] / 2, antechamberEastRoof.size[1] / 2, antechamberEastRoof.size[2] / 2]} position={[antechamberEastRoof.position[0] - originX, antechamberEastRoof.position[1], antechamberEastRoof.position[2] - originZ]} rotation={antechamberEastRoof.rotation} />
        <Box material={resources.ceilingPlaster} name='antechamber-east-stair-ceiling' position={[antechamberEastRoof.position[0] - originX, antechamberEastRoof.position[1], antechamberEastRoof.position[2] - originZ]} rotation={antechamberEastRoof.rotation} size={antechamberEastRoof.size} />
        {/* Brass handrails along both sides of the flight */}
        {resources.handrails.map(({side, geometry, collision}) => <group key={side}>
          <MeshSurfaceCollider args={collision} />
          <mesh castShadow geometry={geometry} material={resources.brass} name={`antechamber-east-handrail-${side < 0 ? 'north' : 'south'}`} receiveShadow />
        </group>)}
      </RigidBody>
      {/* Flush brass nosing strips along each step tread */}
      {antechamberEastFlight.blocks.filter(block => block.tread).map(({position, size: blockSize, top}, i) => <Box key={i} material={resources.inlayBrass} name={`antechamber-east-nosing-${i}`} position={[position[0] - originX - blockSize[0] / 2 + 0.03, top + 0.004, position[2] - originZ]} size={[0.024, 0.008, blockSize[2] - 0.45]} />)}
    </StaticBatch>
  </group>
}
