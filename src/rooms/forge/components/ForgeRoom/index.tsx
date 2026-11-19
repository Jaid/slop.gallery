import type ForgeMaterials from '#src/lib/materials/forge/ForgeMaterials.ts'
import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
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
import AlchemyMachine from '#src/rooms/forge/components/AlchemyMachine/index.tsx'
import slopGallery from '#src/worlds/gallery/index.ts'

import WorksPlate from './WorksPlate.tsx'

const room = slopGallery.room('forge')
const vestibuleWall = slopGallery.walls.find(wall => wall.id === 'forge-vestibule')!
/** Two rows of soapstone tables flank the measuring aisle from the north vestibule to the alchemy workbench. */
export default function ForgeRoom({materials, masonry}: {
  masonry: Material
  materials: ForgeMaterials
}) {
  const [width, depth] = room.size
  return <group name='forge'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[width / 2, floorThickness / 2, depth / 2]} position-y={-floorThickness / 2} />
        <Box material={materials.floor} name='forge-block-floor' position-y={-floorThickness / 2} size={[width, floorThickness, depth]} />
      </RigidBody>
      <Roof kind='sawtooth' materials={materials} />
      <WorksPlate materials={materials} />
    </group>
    <Vestibule masonry={masonry} materials={materials} />
    <AlchemyMachine />
    {forgeRowTables.map(({center: [x, z], name, seed, turn}) => <group key={name} position={[x, 0, z]} rotation-y={turn}>
      <IronTable name={name} seed={seed} table={forgeTable} />
    </group>)}
  </group>
}

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
/** The vestibule keeps its walkable thresholds and the Bastion’s masonry through the western arch. */
function Vestibule({materials, masonry}: {
  masonry: Material
  materials: ForgeMaterials
}) {
  const {center} = forgeVestibule
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
        <mesh geometry={parts.slab} material={materials.floor} name='forge-vestibule-floor' receiveShadow />
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
