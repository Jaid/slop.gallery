import type {Wall} from '#src/lib/gallery.ts'
import type {Material, Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {positionWorld, vec3} from 'three/tsl'
import {Color, MeshStandardNodeMaterial} from 'three/webgpu'

import EngravedPlate from '#component/EngravedPlate'
import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import RoomFloor from '#component/RoomFloor'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {wallFace, wallOpeningTrim} from '#src/lib/gallery/architecture.ts'
import CrumbledStoneGeometry from '#src/lib/gallery/CrumbledStoneGeometry.ts'
import formatByline from '#src/lib/gallery/formatByline.ts'
import {salonSculptureSocket, salonTerrazzo, salonWainscot, wainscotFields, wallDressingSpans} from '#src/lib/gallery/salon.ts'
import salonLantern, {salonDomeSpringY, salonLanternBase} from '#src/lib/gallery/salonLantern.ts'
import SalonLanternGeometry, {lanternPaneSize, salonLanternCollision, shellFilletLines} from '#src/lib/gallery/SalonLanternGeometry.ts'
import {salonSculpture} from '#src/lib/gallery/salonSculpture.ts'
import {salonStone} from '#src/lib/gallery/salonStone.ts'
import ArchitecturalPlasterMaterial from '#src/lib/materials/ArchitecturalPlasterMaterial.ts'
import CrownGlassMaterial from '#src/lib/materials/CrownGlassMaterial.ts'
import FauxMarbleMaterial, {gialloAntico, portoro} from '#src/lib/materials/FauxMarbleMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import ShellInlayMaterial from '#src/lib/materials/ShellInlayMaterial.ts'
import TerrazzoFloorMaterial, {blackTerrazzo, venetianTerrazzo} from '#src/lib/materials/TerrazzoFloorMaterial.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'
import {daylight} from '#src/lib/rendering/daylight.ts'
import {graphicsProfile, isHeavyGraphics} from '#src/lib/rendering/graphicsQuality.ts'
import {createStone} from '#src/stones/index.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import SalonOttoman from '../SalonOttoman/index.tsx'
import SalonSculpture from '../SalonSculpture/index.tsx'

const room = slopGallery.room('salon')
const salonWalls = slopGallery.walls.filter(wall => wall.room === 'salon')
/**
 * The daylight the lantern bounces round, which the renderer leaves out: the sky’s through the windows, cool, the more the higher up inside the drum, and the sunlit floor’s, warm, onto the ceiling round it.
 * Without it, the ceiling, the drum and the dome would only get the fill’s olive ground light and turn khaki and dull.
 */
const bounce = daylight.mul(vec3(...new Color(hsl.integer(269, 100, 92))).mul(positionWorld.y.smoothstep(salonLanternBase, salonDomeSpringY).mul(0.05).add(0.05)).add(vec3(...new Color(hsl.integer(69, 100, 95.7))).mul(0.025)))

/** The Salon: walls frescoed in Pompeian red over a socle painted as marble and hung frame to frame, polished terrazzo underfoot and, overhead, a lantern after the Tribuna of the Uffizi. */
export default function SalonRoom({glass, stone, wood}: {
  glass: Material
  stone: Texture
  wood: Texture
}) {
  // Painted as nero portoro round raised fields of giallo antico, the way Pompeian socles were.
  const socle = useDisposable(useMemo(() => new FauxMarbleMaterial(portoro), []))
  const fields = useDisposable(useMemo(() => new FauxMarbleMaterial(gialloAntico), []))
  const {mirrorReflections} = graphicsProfile
  const terrazzo = useDisposable(useMemo(() => new TerrazzoFloorMaterial({
    center: room.center,
    size: room.size,
    field: venetianTerrazzo,
    border: blackTerrazzo,
    inset: salonTerrazzo.border,
    reflections: mirrorReflections,
    ...salonTerrazzo.polish,
  }), [mirrorReflections]))
  const floor = useMemo(() => ({
    slab: terrazzo,
    reflection: terrazzo.reflectionTarget ?? undefined,
  }), [terrazzo])
  return <group name='salon'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <RoomFloor glass={glass} materials={floor} room={room} stone={stone} wood={wood} />
      <Lantern heavy={isHeavyGraphics} />
    </group>
    {salonWalls.map(wall => <WallDressing key={wall.id} fields={fields} gilt={gold} socle={socle} wall={wall} />)}
    <SalonOttoman />
    <SculptureSocket />
  </group>
}

/** The ceiling and its lantern: the drum’s windows and the lantern over the dome’s eye let the sun in, the stucco, the shells, the gilding and the bronze shade it. */
function Lantern({heavy}: {heavy: boolean}) {
  const geometry = useDisposable(useMemo(() => new SalonLanternGeometry(room.size), []))
  const collision = useMemo(() => salonLanternCollision(room.size), [])
  // Lime stucco a shade toward pink rather than yellow, so the shade under the ceiling doesn’t turn khaki.
  const stucco = useDisposable(useMemo(() => new ArchitecturalPlasterMaterial({
    baseColor: hsl.integer(63, 36, 91),
    bounce,
    heavy,
    roughness: 0.86,
  }), [heavy]))
  const shells = useDisposable(useMemo(() => new ShellInlayMaterial({
    bounce,
    crease: salonLantern.shells.crease,
    heavy,
    lines: shellFilletLines(),
  }), [heavy]))
  // Patinated bronze glazing bars, as on the Vesper’s lantern.
  const bronze = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: hsl.integer(72, 31, 33),
    metalness: 0.5,
    roughness: 0.5,
  }), []))
  // Old drawn glass in the windows, faintly rippled and a little dusty along the sills; the fast one is the lantern’s.
  const windowGlass = useDisposable(useMemo(() => (heavy ? new CrownGlassMaterial({
    name: 'salon-window-glass-heavy',
    ior: 1.52,
    absorption: 0.04,
    specularColor: hsl.integer(80, 100, 96.6),
    clearcoat: 0.3,
    envMapIntensity: 1.2,
    paneSize: [salonLantern.window.width, salonLantern.window.crown - salonLantern.window.sill],
    bodyColor: hsl.integer(133, 34, 96),
    haze: 0.02,
    smudges: 0.035,
    grime: 0.3,
    waviness: 0.003,
  }) : new VaultGlassMaterial({heavy})), [heavy]))
  // The Lobby vault’s cast glass over the eye, a pane in each of its slopes.
  const lanternGlass = useDisposable(useMemo(() => new VaultGlassMaterial({
    heavy,
    paneSize: lanternPaneSize,
  }), [heavy]))
  return <group name='salon-lantern'>
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision} />
    </RigidBody>
    <mesh castShadow geometry={geometry.stucco} material={stucco} name='salon-ceiling' receiveShadow />
    <mesh castShadow geometry={geometry.sails} material={shells} name='salon-dome' receiveShadow />
    <mesh castShadow geometry={geometry.gilt} material={gold} name='salon-lantern-gilding' receiveShadow />
    <mesh castShadow geometry={geometry.bronze} material={bronze} name='salon-lantern-bronze' receiveShadow />
    {/* The glass lets the sun through: it casts no shadow, only its bars do. */}
    <mesh castShadow={false} geometry={geometry.windowGlass} material={windowGlass} name='salon-lantern-windows' />
    <mesh castShadow={false} geometry={geometry.lanternGlass} material={lanternGlass} name='salon-lantern-glass' />
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
/** The socket of sawn stone, the sculpture on it and, on its face toward the doorway, a brass plate naming the work, the model that made it and the year. */
function SculptureSocket() {
  const {position, size} = salonSculptureSocket
  const [width, height, depth] = size
  const geometry = useDisposable(useMemo(() => new CrumbledStoneGeometry(size), [size]))
  const stone = useDisposable(useMemo(() => createStone(salonStone), []))
  return <>
    <RigidBody colliders={false} name='salon-sculpture-socket' position={position} type='fixed'>
      <CuboidCollider args={[width / 2, height / 2, depth / 2]} position={[0, height / 2, 0]} />
      <mesh castShadow geometry={geometry} material={stone} name='sculpture socket' position={[0, height / 2, 0]} receiveShadow />
      <EngravedPlate byline={formatByline(salonSculpture.metadata.author.model.title, salonSculpture.year)} heading={salonSculpture.title} name='salon-sculpture-plate' position={[0, height / 2, depth / 2]} />
    </RigidBody>
    <SalonSculpture material={stone} />
  </>
}
