import type {FloorPolygon} from '#src/lib/gallery/floorPolygons.ts'
import type FloorHollow from '#src/lib/gallery/passages/FloorHollow.ts'
import type Passage from '#src/lib/gallery/passages/Passage.ts'
import type {PassageCutout} from '#src/lib/gallery/passages/Passage.ts'
import type PassageTransition from '#src/lib/gallery/passages/PassageTransition.ts'
import type {PendantMount} from '#src/lib/gallery/pendants/CeilingProbe.ts'
import type {Material} from 'three/webgpu'

import {ConvexHullCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import FloorSlab from '#component/FloorSlab'
import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import PendantLamps from '#component/PendantLamps'
import TimberFrame from '#component/TimberFrame'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {climbPassageLanterns} from '#src/lib/gallery/climb.ts'
import {slabHulls} from '#src/lib/gallery/floorPolygons.ts'
import TimberGeometry from '#src/lib/gallery/passages/TimberGeometry.ts'
import VaultGeometry from '#src/lib/gallery/passages/VaultGeometry.ts'
import {corridorLightSpacing, passagePendantMounts} from '#src/lib/gallery/pendants/mounts.ts'
import {passageLantern, passageLanternGlow} from '#src/lib/gallery/pendants/passageLantern.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

/** how thick the slabs under a passage’s floor and over its ceiling are */
const slabDepth = 0.24
/**
 * Which of a passage’s evenly spaced lanterns, in mount order from the passage’s start, it keeps, by the passage’s name; the rest are left out, and a passage left out keeps all of them. The corridor keeps four: in the doorway passage from the Lodge’s bay, at the north end and in the middle of its long hall, and in the open elbow at the hall’s south end, at the foot of the flight. Its landing supplies its own mount. The Bastion’s eastern straight passages keep none, as its lanterns hang in its curve; its western climb keeps a few, see `climbPassageLanterns`. Their lamps belong to the rooms, see their `lamps.ts`.
 */
const passageLanterns: Partial<Record<string, ReadonlyArray<boolean>>> = {
  corridor: [true, false, false, true, false, true, false, false, true],
  'bastion-mouth': [],
  'bastion-approach': [],
  'bastion-climb_mouth': climbPassageLanterns.mouth,
}
export default function CoveredPassage({passage, sole = false, material, mounts: fixedMounts, paving: pavingOverride, timber, ribCutouts, hollow, transition}: {
  /** a hollow its paving has sunk into */
  hollow?: FloorHollow
  material: Material
  /** fixed lantern mounts in place of the evenly spaced ones */
  mounts?: ReadonlyArray<PendantMount>
  passage: Passage
  /** the floor laid in the passage’s material when other floors cover the rest; collision still uses the full passage floors */
  paving?: ReadonlyArray<FloorPolygon>
  ribCutouts?: ReadonlyArray<PassageCutout>
  /** whether the passage’s lanterns are all that lights it, which spaces them out */
  sole?: boolean
  timber?: Material
  /** a stone passage’s timber end, rendered separately; the paving and vault ribs stop where it begins */
  transition?: PassageTransition
}) {
  const geometry = useDisposable(useMemo(() => (timber ? TimberGeometry.passage(passage, ribCutouts) : new VaultGeometry(passage, transition?.length)), [passage, ribCutouts, timber, transition]))
  // Graphics with more curve detail draw a finer stone vault, which neither collides nor carries the lanterns, so every graphics mode collides alike.
  const {curveDetail} = useGraphicsModeValue(getGraphicsProfile)
  const vault = useDisposable(useMemo(() => (!timber && curveDetail > 1 ? new VaultGeometry(passage, transition?.length, curveDetail) : {
    shell: geometry.shell,
    ribs: geometry.ribs,
    // The base detail’s belong to the passage’s geometry.
    dispose() {},
  }), [curveDetail, geometry, passage, timber, transition]))
  const lanterns = passageLanterns[passage.name]
  // Under timber, lanterns hang from the ribs rather than the planks between them.
  const mounts = useMemo(() => fixedMounts ?? passagePendantMounts(passage, [geometry.shell, geometry.ribs], sole ? corridorLightSpacing : undefined, timber && geometry.ribs).filter((_, index) => lanterns?.[index] ?? !lanterns), [fixedMounts, geometry, lanterns, sole, passage, timber])
  // The hollow takes its footprint out of the floors.
  const floors = hollow ? passage.floors.flatMap(floor => hollow.cut(floor)) : passage.floors
  const paving = pavingOverride ?? transition?.stoneFloors ?? floors
  // A timber lining’s crown is the ceiling along its spans; a slab there would share its plane. Only the open elbows show the slab.
  const ceilings = timber ? passage.junctions : passage.floors
  // A run too short for a rib has none to draw or collide with.
  const collision = timber ? [] : [geometry.shell, geometry.ribs].filter(part => part.hasAttribute('position')).map(colliderGeometry)
  const crown = passage.floorY + passage.height
  return <group name={passage.name}>
    <RigidBody colliders={false} type='fixed'>
      {floors.flatMap(floor => slabHulls(floor, passage.floorY - slabDepth, passage.floorY)).map((corners, i) => <ConvexHullCollider key={i} args={[corners]} />)}
      {passage.floors.flatMap(floor => slabHulls(floor, crown, crown + slabDepth)).map((corners, i) => <ConvexHullCollider key={i} args={[corners]} />)}
      {ceilings.map((ceiling, i) => <FloorSlab key={i} bottom={crown} depth={slabDepth} material={material} polygon={ceiling} />)}
      {paving.map((floor, i) => <FloorSlab key={i} bottom={passage.floorY - slabDepth} depth={slabDepth} material={material} polygon={floor} />)}
      <Branch if={hollow}><SunkenPaving hollow={hollow!} material={material} /></Branch>
      <Branch not={timber}>{collision.map((args, i) => <TrimeshCollider key={i} args={args} />)}</Branch>
      <Branch if={timber}><TimberFrame geometry={geometry} lining={material} material={timber!} /></Branch>
      <Branch not={timber}>
        <mesh castShadow geometry={vault.shell} material={material} name='castle-barrel-vault' receiveShadow />
        <Branch if={vault.ribs.hasAttribute('position')}><mesh castShadow geometry={vault.ribs} material={material} name='castle-vault-ribs' receiveShadow /></Branch>
      </Branch>
    </RigidBody>
    <PendantLamps body={passageLantern} glow={passageLanternGlow} mounts={mounts} name={`${passage.name}-pendants`} />
  </group>
}

/** The paving sunk into a hollow in a passage’s floor, welded, so orbs roll on across it instead of catching on its facets’ edges. */
function SunkenPaving({hollow, material}: {
  hollow: FloorHollow
  material: Material
}) {
  const geometry = useDisposable(useMemo(() => hollow.geometry(), [hollow]))
  const collision = useMemo(() => colliderGeometry(geometry), [geometry])
  return <>
    <MeshSurfaceCollider args={collision} />
    <mesh geometry={geometry} material={material} name='castle-hollow' receiveShadow />
  </>
}
