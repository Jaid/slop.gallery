import type ForgeMaterials from '#src/lib/materials/forge/ForgeMaterials.ts'
import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {ExtrudeGeometry} from 'three/webgpu'

import IronTable from '#component/IronTable'
import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import Box from '#src/components/Scene/primitives.tsx'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import {forgeRowTables, forgeTable, forgeVestibule} from '#src/lib/gallery/forge.ts'
import ForgeRoofGeometry from '#src/lib/gallery/forge/ForgeRoofGeometry.ts'
import {forgeRoundVestibule, vestibuleArches} from '#src/lib/gallery/forgeVestibule.ts'
import roundRevealGeometry from '#src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape, vestibuleArchOpening} from '#src/lib/gallery/roundVestibule.ts'
import EndGrainMaterial from '#src/lib/materials/forge/EndGrainMaterial.ts'
import {graphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import AlchemyMachine from '#src/rooms/forge/components/AlchemyMachine/index.tsx'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('forge')
const vestibuleWall = slopGallery.walls.find(wall => wall.id === 'forge-vestibule')!
/** The Forge: two rows of soapstone tables flank the measuring aisle from the north vestibule to the alchemy workbench under the south wall’s cannon, beneath the sawtooth roof. */
export default function ForgeRoom({materials, masonry}: {
  /** the Bastion’s stone, which lines the vestibule’s arch onto its approach */
  masonry: Material
  materials: ForgeMaterials
}) {
  const [width, depth] = room.size
  const floor = useEndGrain()
  return <group name='forge'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        {/* A collider takes its offset from `position` alone; dashed props like position-y never reach it. */}
        <CuboidCollider args={[width / 2, floorThickness / 2, depth / 2]} position={[0, -floorThickness / 2, 0]} />
        <Box material={floor} name='forge-block-floor' position-y={-floorThickness / 2} size={[width, floorThickness, depth]} />
        <Mirror floor={floor} />
      </RigidBody>
      <Roof kind='sawtooth' materials={materials} />
    </group>
    <Vestibule masonry={masonry} materials={materials} />
    <AlchemyMachine />
    {forgeRowTables.map(({center: [x, z], name, seed, turn}) => <group key={name} position={[x, 0, z]} rotation-y={turn}>
      <IronTable name={name} seed={seed} table={forgeTable} />
    </group>)}
  </group>
}

/** One floor’s end-grain paving, mirroring the room in heavy mode. The room and its vestibule take one each, so either one in view renders the mirror, as its target bounds only the floor it lies in. */
function useEndGrain() {
  const {mirrorReflections} = graphicsProfile
  return useDisposable(useMemo(() => new EndGrainMaterial(mirrorReflections), [mirrorReflections]))
}
/** The floor’s reflection target, laid at the surface of the floor whose body holds it, if the floor mirrors the room. */
function Mirror({floor}: {floor: EndGrainMaterial}) {
  return <Branch if={floor.reflectionTarget}><group rotation-x={-Math.PI / 2}><primitive object={floor.reflectionTarget!} /></group></Branch>
}
/** The room’s sawtooth roof or the vestibule’s hood, in the frame of the floor below: one mesh per finish, and colliders on every surface seen from below, the glass included. */
function Roof({kind, materials}: {
  kind: 'hood' | 'sawtooth'
  materials: ForgeMaterials
}) {
  const roof = useDisposable(useMemo(() => new ForgeRoofGeometry(kind), [kind]))
  return <RigidBody colliders={false} type='fixed'>
    {roof.collision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
    {(['deck', 'frame', 'brass', 'glass'] as const).map(finish => <mesh key={finish} castShadow={finish !== 'glass'} geometry={roof.surfaces[finish]} material={materials[finish]} name={`forge-${kind}-${finish}`} receiveShadow={finish !== 'glass'} />)}
  </RigidBody>
}
/**
 * The round vestibule north of the room: its floor, out under its arches, its hood, and the reveals that line its arches out to the planes touching its wall there:
 * enameled iron through to the room’s north wall, and the Bastion’s stone on from the end of its approach.
 */
function Vestibule({materials, masonry}: {
  masonry: Material
  materials: ForgeMaterials
}) {
  const {center} = forgeVestibule
  const floor = useEndGrain()
  const parts = useDisposable(useMemo(() => {
    const slab = new ExtrudeGeometry(roundVestibuleFloorShape(forgeRoundVestibule), {
      depth: floorThickness,
      bevelEnabled: false,
      curveSegments: 96,
    })
    slab.rotateX(-Math.PI / 2).translate(0, -floorThickness, 0)
    const reveals = vestibuleArches.map(arch => ({
      name: arch.name,
      geometry: roundRevealGeometry(vestibuleWall, vestibuleWall.holes!.find(hole => hole.name === arch.name)!, vestibuleArchOpening(forgeRoundVestibule, arch)),
    }))
    return {
      slab,
      reveals,
      floorCollision: colliderGeometry(slab),
      revealCollision: reveals.map(({geometry}) => colliderGeometry(geometry)),
      dispose() {
        for (const geometry of [slab, ...reveals.map(reveal => reveal.geometry)]) {
          geometry.dispose()
        }
      },
    }
  }, []))
  return <>
    <group name='forge-vestibule' position={[center[0], 0, center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <TrimeshCollider args={parts.floorCollision} />
        <mesh geometry={parts.slab} material={floor} name='forge-vestibule-floor' receiveShadow />
        <Mirror floor={floor} />
      </RigidBody>
      <Roof kind='hood' materials={materials} />
    </group>
    {/* In the round wall’s own frame, as the reveals are built, where its paint knows which way its face looks. */}
    <group name='forge-vestibule-reveals' position={vestibuleWall.center} rotation={[0, vestibuleWall.rotation, 0]}>
      <RigidBody colliders={false} type='fixed'>
        {parts.revealCollision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
        {parts.reveals.map(({name, geometry}) => <mesh key={name} castShadow geometry={geometry} material={name === 'bastion' ? masonry : materials.frame} name={`forge-vestibule-reveal_${name}`} receiveShadow />)}
      </RigidBody>
    </group>
  </>
}
