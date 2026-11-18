import type {Wall} from '#src/lib/gallery.ts'
import type {Material, Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {float, normalGeometry, positionGeometry} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'
import {useGraphicsModeValue} from 'use-graphics-mode'

import BenchSeat from '#component/BenchSeat'
import RoomFloor from '#component/RoomFloor'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {wallFace, wallOpeningTrim} from '#src/lib/gallery/architecture.ts'
import CrumbledStoneGeometry from '#src/lib/gallery/CrumbledStoneGeometry.ts'
import {salonBench, salonBenchLegs, salonSculptureSocket, salonTerrazzo, salonWainscot, wainscotFields, wallDressingSpans} from '#src/lib/gallery/salon.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import FauxMarbleMaterial, {gialloAntico, portoro} from '#src/lib/materials/FauxMarbleMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import SawnCarvingStoneMaterial from '#src/lib/materials/SawnCarvingStoneMaterial.ts'
import TerrazzoFloorMaterial, {blackTerrazzo, venetianTerrazzo} from '#src/lib/materials/TerrazzoFloorMaterial.ts'
import VelvetMaterial from '#src/lib/materials/VelvetMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import SalonCeiling from '../SalonCeiling/index.tsx'
import SalonSculpture from '../SalonSculpture/index.tsx'

const room = slopGallery.room('salon')
const salonWalls = slopGallery.walls.filter(wall => wall.room === 'salon')

/** The Salon: walls frescoed in Pompeian red over a socle painted as marble and hung frame to frame, polished terrazzo underfoot and a fluted oval laylight overhead. */
export default function SalonRoom({glass, stone, wood}: {
  glass: Material
  stone: Texture
  wood: Texture
}) {
  // Painted as nero portoro round raised fields of giallo antico, the way Pompeian socles were.
  const socle = useDisposable(useMemo(() => new FauxMarbleMaterial(portoro), []))
  const fields = useDisposable(useMemo(() => new FauxMarbleMaterial(gialloAntico), []))
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
  return <group name='salon'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <SalonCeiling />
      <RoomFloor glass={glass} materials={floor} room={room} stone={stone} wood={wood} />
    </group>
    {salonWalls.map(wall => <WallDressing key={wall.id} fields={fields} gilt={gold} socle={socle} wall={wall} />)}
    <Ottoman />
    <SculptureSocket />
  </group>
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
