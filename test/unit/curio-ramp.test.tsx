import type {Curio as CurioKind} from '../../src/lib/gallery/curios/index.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {Euler, MeshBasicMaterial, Quaternion, Vector3} from 'three/webgpu'

import Curio from '../../src/components/Curio/index.tsx'
import {curios} from '../../src/lib/gallery/curios/index.ts'
import Slop from '../../src/lib/gallery/curios/slop/Slop.ts'
import {tunnelFloorHeight} from '../../src/lib/gallery/lowerGallery.ts'
import sights, {slopRandom} from '../../src/lib/gallery/sloperator/sights.ts'
import ExhibitionRoom from '../../src/rooms/exhibition/components/ExhibitionRoom/index.tsx'
import {mountPhysics} from './helpers/inertPhysics.tsx'

const glass = sights.find(({id}) => id === 'exhibition_glass')!
const {grade, yaw: uphill} = glass.slope!
/** which way is up off the Exhibition’s sloping floor */
const normal = new Vector3(-grade * Math.sin(uphill), 1, -grade * Math.cos(uphill))
normal.normalize()
/** The curio lying on the ramp at the floor at `[x, z]`, its own up along the floor’s, turned by `yaw` and first laid down on its side by `laid`, its origin as high over the floor as `lift`, and loose. */
function onRamp(curio: CurioKind, [x, z]: readonly [number, number], yaw: number, laid: Vec3 = [0, 0, 0], lift = 0): CurioKind {
  const tilt = new Quaternion
  tilt.setFromUnitVectors(new Vector3(0, 1, 0), normal)
  const turn = new Quaternion
  turn.setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  const lie = new Quaternion
  lie.setFromEuler(new Euler(...laid))
  const rotation = new Euler
  rotation.setFromQuaternion(tilt.multiply(turn).multiply(lie))
  return Object.assign(Object.create(curio) as CurioKind, {
    position: [x, tunnelFloorHeight(x, z)! + lift / normal.y + 0.002, z],
    rotation: [rotation.x, rotation.y, rotation.z],
    type: 'dynamic',
  })
}
test('every curio and the Slop he leaves standing in the Exhibition rest on its sloping floor, where a hull round a flat face would fall through it', async () => {
  const [pumpkin, hatchet, helmet, paintingSet, paletteKnife, bowler] = curios
  const slop = new Slop(glass, {
    fixed: false,
    pose: 'stand',
    position: glass.position,
    surface: 0,
    yaw: glass.yaw,
  }, slopRandom(1, glass.id))
  // Up the ramp from the Slop toward Moonfall, a little under two meters apart, either side of its middle by turns, the hatchet laid on its side
  const placed = [
    slop,
    onRamp(pumpkin, [-1.68, -9.08], 0.4),
    // Lying on its cheeks
    onRamp(hatchet, [-3.6, -8.03], 1, [-Math.PI / 2, 0, 0], 0.023),
    onRamp(helmet, [-3.4, -5.85], 2),
    onRamp(paintingSet, [-5.32, -4.8], 0.6),
    onRamp(paletteKnife, [-5.12, -2.62], 2.5),
    onRamp(bowler, [-7.04, -1.57], 0),
  ]
  const material = new MeshBasicMaterial
  await using mounted = await mountPhysics(<>
    <ExhibitionRoom material={material} />
    {placed.map(curio => <Curio key={curio.id} curio={curio} />)}
  </>)
  const {rigidBodyStates, world} = mounted.physics
  const bodies = placed.map(curio => {
    const handle = [...rigidBodyStates].find(([, {object}]) => object.getObjectByName(curio.propId))![0]
    return world.getRigidBody(handle)
  })
  for (const body of bodies) {
    expect(body.isDynamic()).toBe(true)
  }
  for (let frame = 0; frame < 180; frame++) {
    mounted.physics.step(1 / 60)
  }
  // Three seconds on, each lies where it was put down, on the floor rising toward Moonfall, neither through it nor down the slope.
  const rested = placed.map((curio, index) => {
    const {x, y, z} = bodies[index].translation()
    const [startX, startY, startZ] = curio.position
    return {
      id: curio.id,
      asleep: bodies[index].isSleeping(),
      moved: Math.hypot(x - startX, z - startZ) < 0.03,
      sunk: Math.abs(y - startY) < 0.02,
    }
  })
  expect(rested).toEqual(placed.map(({id}) => ({
    id,
    asleep: true,
    moved: true,
    sunk: true,
  })))
  material.dispose()
})
