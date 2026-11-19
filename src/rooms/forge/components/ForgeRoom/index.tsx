import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {vec3} from 'three/tsl'
import {Color, ExtrudeGeometry, MeshStandardNodeMaterial, Path, Shape} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import IronTable from '#component/IronTable'
import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import {forgeRowTables, forgeTable, forgeVestibule} from '#src/lib/gallery/forge.ts'
import forgeRoof, {forgeRoofSpan} from '#src/lib/gallery/forgeRoof.ts'
import ForgeRoofGeometry, {forgeDomeCollision, ForgeDomeGeometry, forgeRoofCollision} from '#src/lib/gallery/ForgeRoofGeometry.ts'
import {forgeRoundVestibule, vestibuleArches} from '#src/lib/gallery/forgeVestibule.ts'
import {forgeVestibuleDome} from '#src/lib/gallery/forgeVestibuleDome.ts'
import roundRevealGeometry from '#src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape, vestibuleArchOpening} from '#src/lib/gallery/roundVestibule.ts'
import BrickMaterial from '#src/lib/materials/BrickMaterial.ts'
import EndGrainFloorMaterial from '#src/lib/materials/EndGrainFloorMaterial.ts'
import ForgeRoofMaterial from '#src/lib/materials/ForgeRoofMaterial.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'
import {daylight} from '#src/lib/rendering/daylight.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import AlchemyMachine from '#src/rooms/forge/components/AlchemyMachine/index.tsx'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('forge')
const brunswickGreen = '#3a5a49'
const vestibuleWall = slopGallery.walls.find(wall => wall.id === 'forge-vestibule')!
const circleSegments = 96
/** how far in from the vestibule’s wall its brass ring lies, on the line of the room’s inlays */
const vestibuleInlay = 1.25

/**
 * The Forge, a Victorian workshop: walls of red brick in Flemish bond over a glazed dado, with sandstone dressings, under a sawtooth roof of iron and glass that lets the midday sun in, over a floor of end-grain oak blocks. Two rows of soapstone tables flank the aisle from the north vestibule, domed in brick, to the alchemy workbench under the south wall’s cannon.
 */
export default function ForgeRoom({brick, dressings, masonry}: {
  /** the brick of the room’s walls, which its gables continue */
  brick: Material
  /** the sandstone that lines the walls’ openings, and on through the arch into its vestibule */
  dressings: Material
  /** the Bastion’s stone, which lines the vestibule’s arch onto its approach */
  masonry: Material
}) {
  const isHeavy = useGraphicsMode()
  const blocks = useDisposable(useMemo(() => new EndGrainFloorMaterial({seed: 3}), []))
  // Iron painted Brunswick green in an eggshell oil paint, as Victorian ironwork was: the plate, the girders, the sash bars, the rafters and the dome’s rings.
  const ironwork = useDisposable(useMemo(() => {
    const material = new MeshStandardNodeMaterial({
      color: brunswickGreen,
      metalness: 0,
      roughness: 0.45,
    })
    // Without indirect light, the undersides of the girders and rafters would go black; they get the daylight the floor and the limewash bounce up.
    material.emissiveNode = vec3(...new Color(brunswickGreen)).mul(daylight).mul(0.06)
    return material
  }, []))
  return <group name='forge'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <Floor material={blocks} />
      <Roof brick={brick} dressings={dressings} heavy={isHeavy} ironwork={ironwork} />
    </group>
    <Vestibule blocks={blocks} dressings={dressings} heavy={isHeavy} ironwork={ironwork} masonry={masonry} />
    <AlchemyMachine />
    {forgeRowTables.map(({center: [x, z], name, seed, turn}) => <group key={name} position={[x, 0, z]} rotation-y={turn}>
      <IronTable name={name} seed={seed} table={forgeTable} />
    </group>)}
  </group>
}

/** The floor slab over the room’s plan, under the walls to their middles, its top in end-grain blocks. */
function Floor({material}: {material: Material}) {
  const [width, depth] = room.size
  return <RigidBody colliders={false} type='fixed'>
    <CuboidCollider args={[width / 2, floorThickness / 2, depth / 2]} position={[0, -floorThickness / 2, 0]} />
    <mesh material={material} name='forge-floor' position={[0, -floorThickness / 2, 0]} receiveShadow>
      <boxGeometry args={[width, floorThickness, depth]} />
    </mesh>
  </RigidBody>
}
/** The sawtooth roof over the room: its boarded, slated slopes, its brick gables and parapet, its iron and its wired glass, which lets the sun through and casts no shadow, only its iron does. */
function Roof({brick, dressings, heavy, ironwork}: {
  brick: Material
  dressings: Material
  heavy: boolean
  ironwork: Material
}) {
  const geometry = useDisposable(useMemo(() => new ForgeRoofGeometry, []))
  const collision = useMemo(() => forgeRoofCollision(), [])
  const boarding = useDisposable(useMemo(() => new ForgeRoofMaterial, []))
  // The Lobby vault’s cast glass with a wire mesh in it, one pane between every two sash bars.
  const glass = useDisposable(useMemo(() => new VaultGlassMaterial({
    heavy,
    paneSize: [forgeRoofSpan[0] / forgeRoof.girder.panels, 3],
    wire: forgeRoof.wire,
  }), [heavy]))
  return <group name='forge-roof'>
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision} />
    </RigidBody>
    <mesh castShadow geometry={geometry.roof} material={boarding} name='forge-roof-boarding' receiveShadow />
    <mesh castShadow geometry={geometry.gables} material={brick} name='forge-roof-gables' receiveShadow />
    <mesh castShadow geometry={geometry.parapet} material={brick} name='forge-roof-parapet' receiveShadow />
    <mesh castShadow geometry={geometry.coping} material={dressings} name='forge-roof-coping' receiveShadow />
    <mesh castShadow geometry={geometry.iron} material={ironwork} name='forge-roof-iron' receiveShadow />
    <mesh castShadow={false} geometry={geometry.glass} material={glass} name='forge-roof-glass' />
  </group>
}
/** A flat ring lying in the x/z plane with its underside at y = 0, from `inner` to `outer` radius, `depth` thick. */
function ring(inner: number, outer: number, depth: number) {
  const shape = new Shape
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false)
  const hole = new Path
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: circleSegments,
  })
  return geometry.rotateX(-Math.PI / 2)
}
/**
 * The round vestibule north of the room: its floor, out under its arches, in the room’s blocks with a brass ring round it, its brick dome open to the sky at its crown, and the reveals that line its arches out to the planes touching its wall there:
 * sandstone through to the room’s north wall, and the Bastion’s stone on from the end of its approach.
 */
function Vestibule({blocks, dressings, heavy, ironwork, masonry}: {
  blocks: Material
  dressings: Material
  heavy: boolean
  ironwork: Material
  masonry: Material
}) {
  const {center, radius} = forgeVestibule
  const {curveDetail, floorReflections} = useGraphicsModeValue(getGraphicsProfile)
  const brass = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#9d8354',
    metalness: 0.6,
    roughness: 0.35,
    envMapIntensity: floorReflections ? 1 : 0.5,
  }), [floorReflections]))
  const domeBrick = useDisposable(useMemo(() => new BrickMaterial({
    mapping: {
      kind: 'dome',
      center: [center[0], forgeVestibuleDome.springY, center[1]],
      radius: forgeVestibuleDome.radius,
    },
    soot: [7, 10],
  }), [center]))
  const glass = useDisposable(useMemo(() => new VaultGlassMaterial({
    heavy,
    paneSize: [forgeVestibuleDome.oculus * 2 + 0.08, forgeVestibuleDome.oculus * 2 + 0.08],
    wire: forgeRoof.wire,
  }), [heavy]))
  const linings = {
    forge: dressings,
    bastion: masonry,
  }
  const dome = useDisposable(useMemo(() => new ForgeDomeGeometry(64 * curveDetail), [curveDetail]))
  const domeCollision = useMemo(() => forgeDomeCollision(), [])
  const parts = useDisposable(useMemo(() => {
    const slab = new ExtrudeGeometry(roundVestibuleFloorShape(forgeRoundVestibule), {
      depth: floorThickness,
      bevelEnabled: false,
      curveSegments: circleSegments,
    })
    slab.rotateX(-Math.PI / 2).translate(0, -floorThickness, 0)
    const inlay = ring(radius - vestibuleInlay - 0.013, radius - vestibuleInlay + 0.013, 0.012).translate(0, -0.01, 0)
    const reveals = vestibuleArches.map(arch => ({
      name: arch.name,
      geometry: roundRevealGeometry(vestibuleWall, vestibuleWall.holes!.find(hole => hole.name === arch.name)!, vestibuleArchOpening(forgeRoundVestibule, arch)),
    }))
    return {
      slab,
      inlay,
      reveals,
      floorCollision: colliderGeometry(slab),
      revealCollision: reveals.map(({geometry}) => colliderGeometry(geometry)),
      dispose() {
        for (const geometry of [slab, inlay, ...reveals.map(reveal => reveal.geometry)]) {
          geometry.dispose()
        }
      },
    }
  }, [radius]))
  return <>
    <group name='forge-vestibule' position={[center[0], 0, center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <TrimeshCollider args={parts.floorCollision} />
        <MeshSurfaceCollider args={domeCollision} />
        <mesh geometry={parts.slab} material={blocks} name='forge-vestibule-floor' receiveShadow />
        <mesh geometry={parts.inlay} material={brass} name='forge-vestibule-inlay' receiveShadow />
      </RigidBody>
      <mesh castShadow geometry={dome.shell} material={domeBrick} name='forge-vestibule-dome' receiveShadow />
      <mesh castShadow geometry={dome.iron} material={ironwork} name='forge-vestibule-dome-iron' receiveShadow />
      <mesh castShadow={false} geometry={dome.glass} material={glass} name='forge-vestibule-dome-glass' />
    </group>
    {/* In the round wall’s own frame, as the reveals are built, where its paint knows which way its face looks. */}
    <group name='forge-vestibule-reveals' position={vestibuleWall.center} rotation={[0, vestibuleWall.rotation, 0]}>
      <RigidBody colliders={false} type='fixed'>
        {parts.revealCollision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
        {parts.reveals.map(({name, geometry}) => <mesh key={name} castShadow geometry={geometry} material={linings[name]} name={`forge-vestibule-reveal_${name}`} receiveShadow />)}
      </RigidBody>
    </group>
  </>
}
