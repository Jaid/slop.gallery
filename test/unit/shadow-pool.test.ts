import {expect, test} from 'bun:test'

import {Group, PerspectiveCamera, PointLight, Scene} from 'three/webgpu'

import {registerLamp} from '../../src/lib/rendering/lamps.ts'
import {lampSwitches, toggleLightShadow, useLightEdits} from '../../src/lib/rendering/lightLevels.ts'
import {ShadowPool} from '../../src/lib/rendering/shadowPool.ts'

/** a scene holding a pool of `count` slots, and a camera at the origin looking down -z */
const setup = (count: number) => {
  const scene = new Scene
  const pool = new ShadowPool(count)
  scene.add(...pool.slots)
  const camera = new PerspectiveCamera(75, 1, 0.1, 100)
  camera.updateMatrixWorld()
  return {
    camera,
    pool,
    scene,
  }
}
const lamp = (scene: Scene, z: number, shadow?: boolean) => {
  const light = new PointLight('#ffffff', 10, 5)
  light.position.set(0, 0, z)
  if (shadow !== undefined) {
    light.userData.shadow = shadow
  }
  scene.add(light)
  light.updateMatrixWorld()
  return light
}
const update = ({camera, pool, scene}: ReturnType<typeof setup>) => {
  scene.updateMatrixWorld()
  pool.update(scene, camera)
}
test('lights asking for a shadow borrow a slot that copies them, and others don’t', () => {
  const world = setup(2)
  const asking = lamp(world.scene, -4, true)
  const plain = lamp(world.scene, -6)
  update(world)
  expect(world.pool.isLent(asking)).toBe(true)
  expect(world.pool.isLent(plain)).toBe(false)
  const slot = world.pool.slots.find(candidate => candidate.intensity > 0)!
  expect(slot.position.z).toBe(-4)
  expect(slot.intensity).toBe(10)
  expect(slot.distance).toBe(5)
  // The unused slot stays dark and belongs to no room, so its shadow map never updates.
  expect(world.pool.slots.filter(candidate => candidate.intensity === 0)).toHaveLength(1)
})
test('a slot follows its light where it moved this frame, before the frame updates its matrices', () => {
  const world = setup(1)
  const swing = new Group
  world.scene.add(swing)
  const light = new PointLight('#ffffff', 10, 5)
  light.position.set(0, -0.5, 0)
  light.userData.shadow = true
  swing.add(light)
  swing.position.set(0, 0, -4)
  update(world)
  // Physics moves the body after the last frame’s matrices, like the Sienna chandelier swinging.
  swing.position.x = 0.3
  swing.rotation.z = Math.PI / 2
  world.pool.update(world.scene, world.camera)
  const slot = world.pool.slots[0]
  expect(slot.position.x).toBeCloseTo(0.8)
  expect(slot.position.y).toBeCloseTo(0)
  expect(slot.position.z).toBeCloseTo(-4)
})
test('the nearest lights hold the slots, a holder until another comes clearly nearer, and the rest go without', () => {
  const world = setup(1)
  const far = lamp(world.scene, -20, true)
  const near = lamp(world.scene, -4, true)
  update(world)
  expect(world.pool.isLent(near)).toBe(true)
  expect(world.pool.isLent(far)).toBe(false)
  // Only a little farther than the other, the holder keeps its slot.
  near.position.z = -20.5
  update(world)
  expect(world.pool.isLent(near)).toBe(true)
  expect(world.pool.isLent(far)).toBe(false)
  near.position.z = -30
  update(world)
  expect(world.pool.isLent(near)).toBe(false)
  expect(world.pool.isLent(far)).toBe(true)
})
test('a light out of view keeps its slot only while no light in view needs it', () => {
  const world = setup(1)
  const light = lamp(world.scene, -4, true)
  update(world)
  light.position.z = 20
  update(world)
  expect(world.pool.isLent(light)).toBe(true)
  const ahead = lamp(world.scene, -10, true)
  update(world)
  expect(world.pool.isLent(light)).toBe(false)
  expect(world.pool.isLent(ahead)).toBe(true)
})
test('dark lights and lights out of view free or never take slots', () => {
  const world = setup(1)
  const behind = lamp(world.scene, 20, true)
  update(world)
  expect(world.pool.isLent(behind)).toBe(false)
  const ahead = lamp(world.scene, -4, true)
  update(world)
  expect(world.pool.isLent(ahead)).toBe(true)
  ahead.intensity = 0
  update(world)
  expect(world.pool.isLent(ahead)).toBe(false)
})
test('slots only lend themselves while mounted', () => {
  const world = setup(1)
  const asking = lamp(world.scene, -4, true)
  const holder = new Group
  world.scene.remove(...world.pool.slots)
  holder.add(...world.pool.slots)
  update(world)
  expect(world.pool.isLent(asking)).toBe(false)
})
test('the light editor switches a point light’s request for a shadow', () => {
  const world = setup(1)
  const plain = lamp(world.scene, -4)
  expect(toggleLightShadow(plain)).toBe(true)
  update(world)
  expect(world.pool.isLent(plain)).toBe(true)
  expect(toggleLightShadow(plain)).toBe(false)
  update(world)
  expect(world.pool.isLent(plain)).toBe(false)
  // Back to what its owner set, the edit is gone.
  expect(useLightEdits.getState().shadows.has(plain)).toBe(false)
})
test('the pool reports once when more lights in view ask for a shadow than it has slots', () => {
  const world = setup(1)
  const reports: Array<number> = []
  world.pool.onOverflow = lights => reports.push(lights.length)
  const first = lamp(world.scene, -4, true)
  update(world)
  expect(reports).toEqual([])
  lamp(world.scene, -6, true)
  update(world)
  update(world)
  expect(reports).toEqual([2])
  first.intensity = 0
  update(world)
  first.intensity = 10
  update(world)
  expect(reports).toEqual([2, 2])
})
test('a move between fences names the lamps it switches on and off', () => {
  const scene = new Scene
  const group = new Group
  group.name = 'lodge-chandelier'
  scene.add(group)
  const chandelier = new PointLight
  registerLamp(chandelier, {
    id: 'lodge-chandelier',
    optional: false,
    fences: ['lodge', 'corridor'],
  })
  group.add(chandelier)
  for (const index of [0, 1]) {
    const stairLamp = new PointLight
    stairLamp.name = 'stair-lamp'
    registerLamp(stairLamp, {
      id: `stair-lamp-${index}`,
      optional: false,
      fences: ['oculus'],
    })
    scene.add(stairLamp)
  }
  // lit in the Oculus and in a part of the Lodge alone
  const lantern = new PointLight
  lantern.name = 'gate-lantern'
  registerLamp(lantern, {
    id: 'gate-lantern',
    optional: false,
    fences: ['oculus', 'lodge_window'],
  })
  scene.add(lantern)
  const everywhere = new PointLight
  everywhere.name = 'sun-fill'
  scene.add(everywhere)
  expect(lampSwitches(scene, ['oculus'], ['lodge'])).toEqual({
    enabled: 'PointLight in lodge-chandelier',
    enabledCount: 1,
    disabled: 'gate-lantern, stair-lamp ×2',
    disabledCount: 3,
  })
  // Into that part of the Lodge, the lantern stays on, and within the Lodge, crossing into the part switches it on alone.
  expect(lampSwitches(scene, ['oculus'], ['lodge', 'lodge_window'])).toEqual({
    enabled: 'PointLight in lodge-chandelier',
    enabledCount: 1,
    disabled: 'stair-lamp ×2',
    disabledCount: 2,
  })
  expect(lampSwitches(scene, ['lodge'], ['lodge', 'lodge_window'])).toEqual({
    enabled: 'gate-lantern',
    enabledCount: 1,
    disabled: '',
    disabledCount: 0,
  })
  expect(lampSwitches(scene, ['lodge', 'lodge_window'], ['lodge', 'lodge_window'])).toEqual({
    enabled: '',
    enabledCount: 0,
    disabled: '',
    disabledCount: 0,
  })
})
