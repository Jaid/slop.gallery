import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {ExtrudeGeometry} from 'three/webgpu'

import IronTable from '#component/IronTable'
import Box from '#src/components/Scene/primitives.tsx'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import {forgeRowTables, forgeTable, forgeVestibule} from '#src/lib/gallery/forge.ts'
import {forgeRoundVestibule, vestibuleArches} from '#src/lib/gallery/forgeVestibule.ts'
import roundRevealGeometry from '#src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape, vestibuleArchOpening} from '#src/lib/gallery/roundVestibule.ts'
import ForgeFloorMaterial from '#src/lib/materials/forge/ForgeFloorMaterial.ts'
import AlchemyMachine from '#src/rooms/forge/components/AlchemyMachine/index.tsx'
import slopGallery from '#src/worlds/gallery/index.ts'

import ForgeBenchWall from '../ForgeBenchWall/index.tsx'
import ForgeRoof, {ForgeCupola} from '../ForgeRoof/index.tsx'

const room = slopGallery.room('forge')
const vestibuleWall = slopGallery.walls.find(wall => wall.id === 'forge-vestibule')!
/** The Forge: two rows of soapstone tables flank the aisle from the north vestibule to the alchemy workbench under the south wall’s cannon. */
export default function ForgeRoom({masonry, wall, trim}: {
  /** the Bastion’s stone, which lines the vestibule’s arch onto its approach */
  masonry: Material
  trim: Material
  wall: Material
}) {
  const paving = useDisposable(useMemo(() => new ForgeFloorMaterial, []))
  const [width, depth] = room.size
  return <group name='forge'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[width / 2, floorThickness / 2, depth / 2]} position={[0, -floorThickness / 2, 0]} />
      </RigidBody>
      <Box material={paving} name='forge-floor' position={[0, -floorThickness / 2, 0]} size={[width, floorThickness, depth]} />
      <ForgeRoof masonry={wall} />
      <ForgeBenchWall />
    </group>
    <Vestibule masonry={masonry} paving={paving} trim={trim} />
    <AlchemyMachine />
    {forgeRowTables.map(({center: [x, z], name, seed, turn}) => <group key={name} position={[x, 0, z]} rotation-y={turn}>
      <IronTable name={name} seed={seed} table={forgeTable} />
    </group>)}
  </group>
}

/** The round vestibule’s floor and the reveals through to the main room and the Bastion. */
function Vestibule({masonry, paving, trim}: {
  masonry: Material
  paving: Material
  trim: Material
}) {
  const {center} = forgeVestibule
  const linings = {
    forge: trim,
    bastion: masonry,
  }
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
        slab.dispose()
        for (const {geometry} of reveals) {
          geometry.dispose()
        }
      },
    }
  }, []))
  return <>
    <group name='forge-vestibule' position={[center[0], 0, center[1]]}>
      <RigidBody colliders={false} type='fixed'><TrimeshCollider args={parts.floorCollision} /></RigidBody>
      <mesh castShadow geometry={parts.slab} material={paving} name='forge-vestibule-floor' receiveShadow />
      <ForgeCupola />
    </group>
    <group name='forge-vestibule-reveals' position={vestibuleWall.center} rotation={[0, vestibuleWall.rotation, 0]}>
      <RigidBody colliders={false} type='fixed'>
        {parts.revealCollision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
        {parts.reveals.map(({name, geometry}) => <mesh key={name} castShadow geometry={geometry} material={linings[name]} name={`forge-vestibule-reveal_${name}`} receiveShadow />)}
      </RigidBody>
    </group>
  </>
}
