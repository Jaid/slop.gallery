import type {Wall} from '#src/lib/gallery.ts'
import type {Material, Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {float, normalGeometry, positionGeometry} from 'three/tsl'
import {CatmullRomCurve3, DoubleSide, MeshStandardNodeMaterial, TubeGeometry, Vector3} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import BenchSeat from '#component/BenchSeat'
import RoomFloor from '#component/RoomFloor'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {wallFace, wallOpeningTrim} from '#src/lib/gallery/architecture.ts'
import CrumbledStoneGeometry from '#src/lib/gallery/CrumbledStoneGeometry.ts'
import {salonBench, salonBenchLegs, salonCeiling, salonSculptureSocket, salonSkylight, salonSkylightOuter, salonSkylightOuterScale, salonTerrazzo, salonWainscot, wainscotFields, wallDressingSpans} from '#src/lib/gallery/salon.ts'
import {salonCeilingSlabGeometry, salonSkylightGlassGeometry, salonSkylightPoint, salonSkylightWellGeometry} from '#src/lib/gallery/salonSkylight.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import BronzeMaterial from '#src/lib/materials/BronzeMaterial.ts'
import FauxMarbleMaterial, {gialloAntico, portoro} from '#src/lib/materials/FauxMarbleMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import SawnCarvingStoneMaterial from '#src/lib/materials/SawnCarvingStoneMaterial.ts'
import TerrazzoFloorMaterial, {blackTerrazzo, venetianTerrazzo} from '#src/lib/materials/TerrazzoFloorMaterial.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'
import VelvetMaterial from '#src/lib/materials/VelvetMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import SalonSculpture from '../SalonSculpture/index.tsx'

const room = slopGallery.room('salon')
const salonWalls = slopGallery.walls.filter(wall => wall.room === 'salon')

/** The Salon: walls frescoed in Pompeian red over a socle painted as marble and hung frame to frame, polished terrazzo underfoot and a coffered skylight overhead. */
export default function SalonRoom({glass, stone, wood}: {
  glass: Material
  stone: Texture
  wood: Texture
}) {
  // Painted as nero portoro round raised fields of giallo antico, the way Pompeian socles were.
  const socle = useDisposable(useMemo(() => new FauxMarbleMaterial(portoro), []))
  const fields = useDisposable(useMemo(() => new FauxMarbleMaterial(gialloAntico), []))
  const plaster = useDisposable(useMemo(() => {
    const material = new SawnCarvingStoneMaterial
    material.side = DoubleSide
    return material
  }, []))
  const isHeavy = useGraphicsMode()
  const {floorReflections} = useGraphicsModeValue(getGraphicsProfile)
  const terrazzo = useDisposable(useMemo(() => new TerrazzoFloorMaterial({
    center: room.center,
    size: room.size,
    field: venetianTerrazzo,
    border: blackTerrazzo,
    inset: salonTerrazzo.border,
    reflections: floorReflections,
    ...salonTerrazzo.polish,
  }), [floorReflections]))
  const floor = useMemo(() => ({
    slab: terrazzo,
    reflection: terrazzo.reflectionTarget ?? undefined,
  }), [terrazzo])
  // The Lobby vault’s cast glass, divided into the same panes as the bars below it.
  const skylight = useDisposable(useMemo(() => new VaultGlassMaterial({
    heavy: isHeavy,
    paneSize: salonSkylight.opening,
  }), [isHeavy]))
  const ceilingGeometry = useDisposable(useMemo(() => {
    const geometry = salonCeilingSlabGeometry()
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, []))
  return <group name='salon'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        {/* The rectangular collision envelope can be hollow too: props and the flying player are not stopped over the glazed rosette. */}
        <CuboidCollider args={[(room.size[0] / 2 - salonSkylightOuter[0]) / 2, 0.09, room.size[1] / 2]} position={[-(room.size[0] / 2 + salonSkylightOuter[0]) / 2, salonCeiling.y, 0]} />
        <CuboidCollider args={[(room.size[0] / 2 - salonSkylightOuter[0]) / 2, 0.09, room.size[1] / 2]} position={[(room.size[0] / 2 + salonSkylightOuter[0]) / 2, salonCeiling.y, 0]} />
        <CuboidCollider args={[salonSkylightOuter[0], 0.09, (room.size[1] / 2 - salonSkylightOuter[1]) / 2]} position={[0, salonCeiling.y, -(room.size[1] / 2 + salonSkylightOuter[1]) / 2]} />
        <CuboidCollider args={[salonSkylightOuter[0], 0.09, (room.size[1] / 2 - salonSkylightOuter[1]) / 2]} position={[0, salonCeiling.y, (room.size[1] / 2 + salonSkylightOuter[1]) / 2]} />
      </RigidBody>
      <RoomFloor glass={glass} materials={floor} room={room} stone={stone} wood={wood} />
      {/* A continuous ceiling rather than four slabs: its petal-shaped opening lets the rosette read as one architectural idea. */}
      <mesh castShadow geometry={ceilingGeometry} material={plaster} name='salon-ceiling' position={[0, salonCeiling.underside, 0]} receiveShadow />
      <Skylight glass={skylight} plaster={plaster} />
    </group>
    {salonWalls.map(wall => <WallDressing key={wall.id} fields={fields} gilt={gold} socle={socle} wall={wall} />)}
    <Ottoman />
    <SculptureSocket />
  </group>
}

function Skylight({glass, plaster}: {
  glass: Material
  plaster: Material
}) {
  const bronze = useDisposable(useMemo(() => new BronzeMaterial, []))
  const {barDepth, barWidth, glassY, ribs} = salonSkylight
  const geometry = useDisposable(useMemo(() => ({
    glass: salonSkylightGlassGeometry(),
    well: salonSkylightWellGeometry(),
    rings: [
      [0.42, glassY - 0.02],
      [0.73, glassY - 0.02],
      [1, glassY - 0.02],
      [salonSkylightOuterScale, salonCeiling.underside - 0.015],
    ].map(([scale, y]) => {
      const points = Array.from({length: salonSkylight.segments}, (_, i) => {
        const [x, z] = salonSkylightPoint(i / salonSkylight.segments * Math.PI * 2, scale)
        return new Vector3(x, y, z)
      })
      return new TubeGeometry(new CatmullRomCurve3(points, true), salonSkylight.segments, scale > 1 ? 0.045 : 0.026, 5, true)
    }),
    dispose() {
      this.glass.dispose()
      this.well.dispose()
      for (const ring of this.rings) {
        ring.dispose()
      }
    },
  }), [glassY]))
  const spokes = Array.from({length: ribs}, (_, i) => {
    const angle = i / ribs * Math.PI * 2
    const [x, z] = salonSkylightPoint(angle)
    const radialLength = Math.hypot(x, z)
    const hubRadius = 0.12
    return {
      angle,
      length: radialLength - hubRadius,
      position: [(x + x / radialLength * hubRadius) / 2, glassY - barDepth / 2, (z + z / radialLength * hubRadius) / 2] as const,
    }
  })
  return <StaticBatch name='salon-skylight'>
    {/* Chalky plaster turns the ceiling into a shallow flared well; the asymmetrically lit folds reveal its lobes without ornament. */}
    <mesh castShadow geometry={geometry.well} material={plaster} name='salon-skylight-well' receiveShadow />
    {/* A rosette of hand-rubbed bronze divides the sunlight into petals, with fine concentric seams between them. */}
    {spokes.map(({angle, length, position}) => <mesh key={angle} castShadow material={bronze} position={position} receiveShadow rotation={[0, -angle, 0]}><boxGeometry args={[length, barDepth, barWidth]} /></mesh>)}
    {geometry.rings.map((ring, index) => <mesh key={index} castShadow geometry={ring} material={bronze} name={`salon-skylight-ring-${index}`} receiveShadow />)}
    <mesh castShadow material={bronze} position={[0, glassY - barDepth / 2, 0]} receiveShadow><cylinderGeometry args={[0.12, 0.12, barDepth, 24]} /></mesh>
    <mesh castShadow geometry={geometry.glass} material={glass} name='salon-skylight-glass' position={[0, glassY + 0.01, 0]} />
  </StaticBatch>
}
function WallDressing({fields, gilt, socle, wall}: {
  /** the raised fields */
  fields: Material
  gilt: Material
  /** the dado round them */
  socle: Material
  wall: Wall
}) {
  const {bottom, fieldDepth, margin, panelDepth, railBottom, railDepth, railHeight} = salonWainscot
  // North and south runs reach the corners; east and west ones stop at their faces, so no two meet in the same solid.
  const reachesCorners = Math.abs(Math.sin(wall.rotation)) < 0.5
  const panels = wallDressingSpans(wall, wallOpeningTrim, wallFace + (reachesCorners ? 0 : panelDepth))
  const rails = wallDressingSpans(wall, wallOpeningTrim, wallFace + (reachesCorners ? 0 : railDepth))
  return <StaticBatch name={`${wall.id}-wainscot`} position={wall.center} rotation={[0, wall.rotation, 0]}>
    {panels.map(([start, end]) => <group key={start}>
      <Box material={socle} position={[(start + end) / 2, (bottom + railBottom) / 2, wallFace + panelDepth / 2]} size={[end - start, railBottom - bottom, panelDepth]} />
      {wainscotFields(start, end).map(([center, width]) => <Box key={center} material={fields} position={[center, (bottom + railBottom) / 2, wallFace + panelDepth + fieldDepth / 2]} size={[width, railBottom - bottom - margin * 2, fieldDepth]} />)}
    </group>)}
    {rails.map(([start, end]) => <Box key={start} material={gilt} position={[(start + end) / 2, railBottom + railHeight / 2, wallFace + railDepth / 2]} size={[end - start, railHeight, railDepth]} />)}
  </StaticBatch>
}
function SculptureSocket() {
  const {position, size} = salonSculptureSocket
  const [width, height, depth] = size
  const geometry = useDisposable(useMemo(() => new CrumbledStoneGeometry(size), [size]))
  const stone = useDisposable(useMemo(() => new SawnCarvingStoneMaterial, []))
  return <>
    <RigidBody colliders={false} name='salon-sculpture-socket' position={position} type='fixed'>
      <CuboidCollider args={[width / 2, height / 2, depth / 2]} position={[0, height / 2, 0]} />
      <mesh castShadow geometry={geometry} material={stone} name='sculpture socket' position={[0, height / 2, 0]} receiveShadow />
    </RigidBody>
    <SalonSculpture material={stone} />
  </>
}
function Ottoman() {
  const {apronHeight, cushionHeight, depth, legHeight, position, seatHeight, width} = salonBench
  const seatThickness = cushionHeight + 0.02
  const velvet = useDisposable(useMemo(() => {
    // Carry the nap from the flat seat over the rounded edges instead of stretching it down the sides.
    const drop = float(seatThickness / 2).sub(positionGeometry.y)
    const coordinates = positionGeometry.xz.add(normalGeometry.xz.mul(drop))
    return new VelvetMaterial(coordinates.mul(4), {seed: environmentSeed})
  }, [seatThickness]))
  const walnut = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#3a2214',
    roughness: 0.45,
  }), []))
  return <RigidBody colliders={false} name='salon-ottoman' position={position} type='fixed'>
    <CuboidCollider args={[width / 2, seatHeight / 2, depth / 2]} position={[0, seatHeight / 2, 0]} />
    {salonBenchLegs.map(([x, z]) => <mesh key={`${x}:${z}`} castShadow material={walnut} position={[x, legHeight / 2, z]} receiveShadow><cylinderGeometry args={[0.04, 0.026, legHeight, 16]} /></mesh>)}
    <Box material={walnut} position={[0, legHeight + apronHeight / 2, 0]} size={[width - 0.06, apronHeight, depth - 0.06]} />
    <BenchSeat material={velvet} position={[0, legHeight + apronHeight + cushionHeight / 2, 0]} size={[width, seatThickness, depth]} />
  </RigidBody>
}
