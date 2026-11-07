import type LodgeMaterials from '#src/lib/materials/LodgeMaterials.ts'

import {ConvexHullCollider, RigidBody} from '@react-three/rapier'
import {Shape, Vector2} from 'three/webgpu'

import LodgeCeiling from '#component/LodgeCeiling'
import LodgeFire from '#component/LodgeFire'
import LodgeFireGuard from '#component/LodgeFireGuard'
import LodgeFurnishings from '#component/LodgeFurnishings'
import LodgeHatchetHook from '#component/LodgeHatchetHook'
import Box from '#src/components/Scene/primitives.tsx'
import {slabHulls} from '#src/lib/gallery/floorPolygons.ts'
import lodge, {lodgeOutline} from '#src/lib/gallery/lodge.ts'
import lodgeInterior from '#src/lib/gallery/lodgeInterior/layout.ts'

const {fireplace} = lodgeInterior
/** Interior face of the room walls, measured from the room’s center. */
const wallInside = lodge.size[1] / 2 - 0.105
/** Past the wall face, so breast and chimney never show a seam against the logs. */
const breastBack = wallInside + 0.055
/** The floor plan with its bay in the room’s frame. */
const plan = lodgeOutline.map(([x, z]) => [x - lodge.center[0], z - lodge.center[1]] as const)
/** The plan as a shape for the slabs, which are extruded upward from it after turning its y to −z. */
const planShape = new Shape(plan.map(([x, z]) => new Vector2(x, -z)))
const floorSlab = {
  depth: 0.3,
  bevelEnabled: false,
}
const ceilingSlab = {
  depth: 0.24,
  bevelEnabled: false,
}
const floorHulls = slabHulls(plan, -floorSlab.depth, 0)
const ceilingHulls = slabHulls(plan, lodge.height, lodge.height + ceilingSlab.depth)

/**
 * The Lodge: log walls with chinking and a half-octagon bay to the north, a wide-plank oak floor, a smoke-darkened board ceiling on hewn beams, hips fanning into the bay from the chandelier’s boss and a fieldstone fireplace, furnished around the hearth.
 *
 * The walls themselves are drawn by `WallSurface` with `materials.logWall`; this adds everything inside them.
 */
export default function LodgeRoom({materials}: {materials: LodgeMaterials}) {
  const {hearth, raisedBed, mantel, chimney} = fireplace
  const pillarWidth = fireplace.width / 2 - fireplace.openingHalfWidth
  const breastDepth = breastBack - fireplace.front
  const lintelTop = fireplace.opening + fireplace.lintelHeight
  const chimneyHeight = lodge.height - lintelTop
  return <group name='lodge-room' position={[lodge.center[0], lodge.floorY, lodge.center[1]]}>
    <RigidBody colliders={false} type='fixed'>
      {[...floorHulls, ...ceilingHulls].map((corners, i) => <ConvexHullCollider key={i} args={[corners]} />)}
      <mesh castShadow material={materials.floor} name='lodge-floor' position={[0, -floorSlab.depth, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={[planShape, floorSlab]} /></mesh>
      <mesh castShadow material={materials.ceiling} name='lodge-ceiling' position={[0, lodge.height, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={[planShape, ceilingSlab]} /></mesh>
    </RigidBody>
    <LodgeCeiling material={materials.timber} />
    <group name='lodge-fireplace' rotation={[0, Math.PI, 0]}>
      <RigidBody colliders='cuboid' type='fixed'>
        <Box material={materials.stone} name='lodge-hearth' position={[0, hearth.size[1] / 2, -hearth.z]} size={hearth.size} />
        <Box material={materials.stone} name='lodge-firebox-raised-bed' position={[0, hearth.size[1] + raisedBed.size[1] / 2, -raisedBed.z]} size={raisedBed.size} />
        {[-1, 1].map(side => <Box key={side} material={materials.stone} name='lodge-fireplace-pillar' position={[side * (fireplace.openingHalfWidth + pillarWidth / 2), (hearth.size[1] + fireplace.opening) / 2, -(fireplace.front + breastDepth / 2)]} size={[pillarWidth, fireplace.opening - hearth.size[1], breastDepth]} />)}
        <Box material={materials.stone} name='lodge-fireplace-lintel' position={[0, fireplace.opening + fireplace.lintelHeight / 2, -(fireplace.front + breastDepth / 2)]} size={[fireplace.width, fireplace.lintelHeight, breastDepth]} />
        <Box material={materials.timber} name='lodge-mantel' position={[0, lintelTop + mantel.size[1] / 2, -(fireplace.front - mantel.overhang + mantel.size[2] / 2)]} size={mantel.size} />
        <Box material={materials.stone} name='lodge-chimney' position={[0, lintelTop + chimneyHeight / 2, -(breastBack - chimney.depth / 2)]} size={[chimney.width, chimneyHeight, chimney.depth]} />
        <Box material={materials.soot} name='lodge-firebox-back' position={[0, (hearth.size[1] + fireplace.opening) / 2, -fireplace.back - 0.02]} size={[fireplace.openingHalfWidth * 2, fireplace.opening - hearth.size[1], 0.04]} />
      </RigidBody>
      <LodgeFire />
      <LodgeFireGuard material={materials.iron} />
    </group>
    <LodgeFurnishings materials={materials} />
    <LodgeHatchetHook material={materials.iron} />
  </group>
}
