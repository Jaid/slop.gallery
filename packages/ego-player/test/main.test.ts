import type {EgoInput, EgoOptions, EgoPosition} from '../src/main.ts'

import {afterEach, beforeEach, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Quaternion, Vector3} from 'three/webgpu'

import {defaultEgoOptions, egoControls, EgoMotor} from '../src/main.ts'

await RAPIER.init()
let world: RAPIER.World
let motors: Array<EgoMotor>
const rotation = new Quaternion
beforeEach(() => {
  world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  motors = []
})
afterEach(() => {
  for (const motor of motors) {
    motor.dispose()
  }
  world.free()
})
function player(options: EgoOptions = {}, position: EgoPosition = [0, 0.04, 0]) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...position))
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
  const motor = new EgoMotor(RAPIER, world, body, collider, options)
  motors.push(motor)
  return motor
}
function floor() {
  return world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setTranslation(0, -0.1, 0))
}
function tick(motor: EgoMotor, input: EgoInput = {}, count = 1, active = true, flying = false) {
  for (let i = 0; i < count; i++) {
    motor.step(world.timestep, input, rotation, active, flying)
    world.step()
  }
}
function grounded(options: EgoOptions = {}) {
  floor()
  const motor = player(options)
  tick(motor, {}, 30)
  expect(motor.grounded).toBe(true)
  return motor
}
test('default bindings and options are immutable', () => {
  expect(Object.isFrozen(defaultEgoOptions)).toBe(true)
  expect(Object.isFrozen(egoControls.forward)).toBe(true)
})
test('settles at feet-relative capsule clearance and reports physical state', () => {
  const motor = grounded()
  expect(motor.body.translation().y).toBeCloseTo(0.02, 2)
  expect(motor.getState()).toMatchObject({
    grounded: true,
    crouching: false,
    active: true,
  })
  tick(motor, {forward: true}, 60)
  expect(motor.getState().velocity.z).toBeCloseTo(-defaultEgoOptions.speed, 2)
  expect(motor.body.translation().z).toBeLessThan(-2)
  const snapshot = motor.getState()
  tick(motor, {right: true}, 60)
  expect(snapshot.position.x).toBeCloseTo(0)
  expect(snapshot.velocity.z).toBeCloseTo(-defaultEgoOptions.speed, 2)
})
test('flying follows the look direction through geometry and falls after landing', () => {
  const motor = grounded()
  const pitched = new Quaternion
  pitched.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 4)
  for (let i = 0; i < 60; i++) {
    motor.step(world.timestep, {forward: true}, pitched, true, true)
    world.step()
  }
  expect(motor.getState()).toMatchObject({
    flying: true,
    grounded: false,
  })
  expect(motor.getState().velocity.y).toBeCloseTo(defaultEgoOptions.speed * Math.SQRT1_2, 4)
  expect(motor.getState().velocity.z).toBeCloseTo(-defaultEgoOptions.speed * Math.SQRT1_2, 4)
  const height = motor.body.translation().y
  expect(height).toBeGreaterThan(1)
  tick(motor, {}, 1, true, true)
  expect(motor.getState().velocity.y).toBe(0)
  tick(motor, {
    left: true,
    sprint: true,
  }, 1, true, true)
  expect(motor.getState().velocity.x).toBeCloseTo(-defaultEgoOptions.speed * defaultEgoOptions.sprintFactor * 2, 4)
  tick(motor, {}, 60, true, true)
  expect(motor.body.translation().y).toBeCloseTo(height, 4)
  tick(motor, {crouch: true}, 120, true, true)
  expect(motor.body.translation().y).toBeLessThan(-1)
  tick(motor, {jump: true}, 120, true, true)
  expect(motor.body.translation().y).toBeGreaterThan(1)
  tick(motor, {}, 120)
  expect(motor.flying).toBe(false)
  expect(motor.grounded).toBe(true)
  expect(motor.body.translation().y).toBeCloseTo(0.02, 2)
})
test('partial input is neutral and diagonal input is normalized', () => {
  const motor = grounded()
  tick(motor, {
    forward: true,
    right: true,
  }, 60)
  expect(Math.hypot(motor.getState().velocity.x, motor.getState().velocity.z)).toBeCloseTo(defaultEgoOptions.speed, 2)
  tick(motor, {}, 60)
  expect(motor.horizontalSpeed).toBeLessThan(0.001)
  expect(Number.isFinite(motor.body.translation().z)).toBe(true)
})
test('sprint and crouch speeds preserve feet and resize the collider synchronously', () => {
  const motor = grounded()
  tick(motor, {
    forward: true,
    sprint: true,
  }, 90)
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed * defaultEgoOptions.sprintFactor, 2)
  tick(motor, {
    forward: true,
    crouch: true,
    sprint: true,
  }, 90)
  expect(motor.crouching).toBe(true)
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed * defaultEgoOptions.crouchFactor, 2)
  expect(motor.body.collider(0).halfHeight()).toBeCloseTo(0.3)
  expect(motor.body.collider(0).translation().y - motor.body.translation().y).toBeCloseTo(0.6)
  expect(motor.body.translation().y).toBeCloseTo(0.02, 2)
  tick(motor)
  expect(motor.crouching).toBe(false)
  expect(motor.body.collider(0).halfHeight()).toBeCloseTo(0.55)
})
test('cannot stand under a ceiling but stands after clearance is restored', () => {
  const motor = grounded()
  tick(motor, {crouch: true})
  const ceiling = world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, 1.3, 0))
  world.step()
  tick(motor, {}, 10)
  expect(motor.crouching).toBe(true)
  world.removeCollider(ceiling, false)
  world.step()
  tick(motor)
  expect(motor.crouching).toBe(false)
})
test('sensors and disabled ceilings do not block standing', () => {
  const motor = grounded()
  tick(motor, {crouch: true})
  world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, 1.3, 0).setSensor(true))
  world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, 1.4, 0).setEnabled(false))
  world.step()
  tick(motor)
  expect(motor.crouching).toBe(false)
})
test('walls stop motion and collision-resolved velocity excludes attempted motion', () => {
  const motor = grounded()
  world.createCollider(RAPIER.ColliderDesc.cuboid(5, 2, 0.1).setTranslation(0, 1, -1))
  world.step()
  tick(motor, {forward: true}, 120)
  expect(motor.body.translation().z).toBeGreaterThan(-0.61)
  expect(motor.body.translation().z).toBeLessThan(-0.55)
  // Allow Rapier’s small contact corrections while rejecting attempted walking velocity.
  expect(Math.abs(motor.getState().velocity.z)).toBeLessThan(0.01)
})
test('impacts report a first contact once, with the speed that led into it', () => {
  const motor = grounded()
  const wall = world.createCollider(RAPIER.ColliderDesc.cuboid(5, 2, 0.1).setTranslation(0, 1, -3))
  world.step()
  const hits: Array<{
    airborne: boolean
    speed: number
  }> = []
  for (let i = 0; i < 240; i++) {
    tick(motor, {forward: true})
    for (const impact of motor.impacts) {
      if (impact.collider.handle !== wall.handle) {
        continue
      }
      expect(impact.normal.z).toBeCloseTo(1, 2)
      hits.push(impact)
    }
  }
  expect(hits).toHaveLength(1)
  expect(hits[0].airborne).toBe(false)
  expect(hits[0].speed).toBeCloseTo(defaultEgoOptions.speed, 1)
  // Pressing against the wall keeps the requested momentum, but a jump from there is no new hit.
  tick(motor, {
    forward: true,
    jump: true,
  }, 60)
  expect(motor.impacts.some(impact => impact.collider.handle === wall.handle)).toBe(false)
})
test('a sprinting jump into a wall is an airborne impact at sprint speed', () => {
  const motor = grounded()
  const wall = world.createCollider(RAPIER.ColliderDesc.cuboid(5, 4, 0.1).setTranslation(0, 1, -5))
  world.step()
  tick(motor, {
    forward: true,
    sprint: true,
  }, 30)
  const hits: Array<{
    airborne: boolean
    speed: number
  }> = []
  for (let i = 0; i < 120; i++) {
    tick(motor, {
      forward: true,
      sprint: true,
      jump: true,
    })
    hits.push(...motor.impacts.filter(impact => impact.collider.handle === wall.handle))
  }
  expect(hits).toHaveLength(1)
  expect(hits[0].airborne).toBe(true)
  expect(hits[0].speed).toBeGreaterThan(defaultEgoOptions.speed * defaultEgoOptions.sprintFactor * 0.9)
})
test('collision groups apply to movement and standing queries', () => {
  const motor = grounded({collisionGroups: 0x00_01_00_01})
  world.createCollider(RAPIER.ColliderDesc.cuboid(5, 2, 0.1).setTranslation(0, 1, -1).setCollisionGroups(0x00_02_00_02))
  world.step()
  tick(motor, {forward: true}, 90)
  expect(motor.body.translation().z).toBeLessThan(-2)
  motor.teleport([0, 0.04, 0])
  tick(motor, {crouch: true}, 30)
  world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, 1.3, 0).setCollisionGroups(0x00_02_00_02))
  world.step()
  tick(motor)
  expect(motor.crouching).toBe(false)
})
test('jump reaches its configured height and holding does not auto-jump on landing', () => {
  const motor = grounded()
  const start = motor.body.translation().y
  let peak = start
  for (let i = 0; i < 150; i++) {
    tick(motor, {jump: true})
    peak = Math.max(peak, motor.body.translation().y)
  }
  expect(peak - start).toBeGreaterThan(1.45)
  expect(peak - start).toBeLessThan(1.6)
  expect(motor.grounded).toBe(true)
})
test('release shortens jumps and a repress during coyote time does not double-jump', () => {
  const motor = grounded()
  tick(motor, {jump: true})
  const launched = motor.getState().velocity.y
  tick(motor)
  const released = motor.getState().velocity.y
  expect(released).toBeLessThan(launched * 0.6)
  tick(motor, {jump: true})
  expect(motor.getState().velocity.y).toBeLessThan(released)
})
test('a fling replaces momentum and releasing jump does not cut it short', () => {
  const motor = grounded()
  tick(motor, {forward: true}, 60)
  tick(motor, {
    forward: true,
    jump: true,
  })
  const start = motor.body.translation().z
  motor.fling({
    x: 0,
    y: 3,
    z: 5,
  })
  tick(motor)
  const {velocity} = motor.getState()
  expect(velocity.x).toBeCloseTo(0, 4)
  expect(velocity.y).toBeCloseTo(3 - defaultEgoOptions.gravity * world.timestep, 4)
  expect(velocity.z).toBeCloseTo(5 - defaultEgoOptions.airDeceleration * world.timestep, 4)
  for (let i = 0; i < 120 && !motor.grounded; i++) {
    tick(motor)
  }
  expect(motor.grounded).toBe(true)
  // About half a second in the air, slowed only by air deceleration, it lands 2.4 m back.
  expect(motor.body.translation().z - start).toBeGreaterThan(2.3)
})
test('a fling off the ground spends coyote time, and one while flying is ignored', () => {
  const motor = grounded()
  motor.fling({
    x: 4,
    y: 3,
    z: 0,
  })
  expect(motor.grounded).toBe(false)
  tick(motor, {jump: true})
  expect(motor.getState().velocity.y).toBeCloseTo(3 - defaultEgoOptions.gravity * world.timestep, 4)
  expect(motor.getState().velocity.x).toBeCloseTo(4 - defaultEgoOptions.airDeceleration * world.timestep, 4)
  tick(motor, {}, 1, true, true)
  motor.fling({
    x: 9,
    y: 9,
    z: 9,
  })
  tick(motor, {}, 1, true, true)
  expect(motor.getState().velocity).toEqual({
    x: 0,
    y: 0,
    z: 0,
  })
  expect(() => motor.fling({
    x: Number.NaN,
    y: 0,
    z: 0,
  })).toThrow(RangeError)
})
test('coyote time allows a jump after walking off a ledge', () => {
  const ground = floor()
  const motor = player()
  tick(motor, {}, 30)
  world.removeCollider(ground, false)
  world.step()
  tick(motor, {}, 3)
  expect(motor.grounded).toBe(false)
  tick(motor, {jump: true})
  expect(motor.getState().velocity.y).toBeGreaterThan(5)
})
test('buffered jump fires on landing but disabling input clears the buffer', () => {
  const motor = grounded()
  motor.teleport([0, 0.06, 0])
  tick(motor, {jump: true})
  let launched = false
  for (let i = 0; i < 20; i++) {
    tick(motor, {jump: true})
    launched ||= motor.getState().velocity.y > 4
  }
  expect(launched).toBe(true)
  tick(motor)
  motor.teleport([0, 0.06, 0])
  tick(motor, {jump: true})
  tick(motor, {jump: true}, 30, false)
  expect(motor.grounded).toBe(true)
  expect(motor.getState().active).toBe(false)
})
test('teleport resets momentum, grounded history, pending translation and jump buffer', () => {
  const motor = grounded()
  tick(motor, {forward: true}, 30)
  tick(motor, {jump: true})
  motor.teleport([8, 3, 7])
  expect(motor.getState()).toMatchObject({
    grounded: false,
    position: {
      x: 8,
      y: 3,
      z: 7,
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
    },
  })
  world.step()
  expect(motor.body.translation()).toEqual({
    x: 8,
    y: 3,
    z: 7,
  })
  tick(motor, {jump: true})
  expect(motor.getState().velocity.y).toBeLessThan(0)
  expect(motor.body.translation().x).toBe(8)
  expect(motor.body.translation().z).toBe(7)
  tick(motor)
  tick(motor, {jump: true})
  expect(motor.getState().velocity.y).toBeLessThan(0)
})
test('disabled input decelerates without freezing gravity or allowing a jump', () => {
  const motor = grounded()
  tick(motor, {forward: true}, 30)
  tick(motor, {
    forward: true,
    jump: true,
  }, 60, false)
  expect(motor.horizontalSpeed).toBeLessThan(0.001)
  expect(motor.grounded).toBe(true)
  motor.teleport([0, 4, 0])
  tick(motor, {jump: true}, 30, false)
  expect(motor.body.translation().y).toBeLessThan(3)
})
test('separate motors do not share velocity or jump state', () => {
  const first = player({gravity: 0}, [-2, 0.04, 0])
  const second = player({gravity: 0}, [2, 0.04, 0])
  for (let i = 0; i < 90; i++) {
    first.step(world.timestep, {forward: true}, rotation)
    second.step(world.timestep, {}, rotation)
    world.step()
  }
  expect(first.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed, 2)
  expect(second.horizontalSpeed).toBeLessThan(0.001)
  expect(second.body.translation().z).toBe(0)
})
test('movement follows yaw even when the camera looks straight up', () => {
  const motor = grounded()
  const yaw = new Quaternion
  yaw.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
  const pitch = new Quaternion
  pitch.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
  const look = yaw.multiply(pitch)
  for (let i = 0; i < 90; i++) {
    motor.step(world.timestep, {forward: true}, look)
    world.step()
  }
  expect(motor.getState().velocity.x).toBeCloseTo(-defaultEgoOptions.speed, 2)
  expect(motor.getState().velocity.z).toBeCloseTo(0, 2)
})
test('options update without losing momentum and undefined restores defaults', () => {
  const motor = grounded()
  tick(motor, {forward: true}, 60)
  motor.configure({
    speed: 4,
    radius: 0.4,
    height: 2,
  })
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed, 2)
  expect(motor.body.collider(0).radius()).toBeCloseTo(0.4)
  expect(motor.body.collider(0).translation().y - motor.body.translation().y).toBeCloseTo(1, 5)
  tick(motor, {forward: true}, 60)
  expect(motor.horizontalSpeed).toBeCloseTo(4, 2)
  motor.configure({speed: undefined})
  expect(motor.body.collider(0).translation().y - motor.body.translation().y).toBeCloseTo(defaultEgoOptions.height / 2, 5)
  tick(motor, {forward: true}, 60)
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed, 2)
})
test('invalid deltas are inert and short timesteps are not artificially enlarged', () => {
  const motor = player({
    gravity: 0,
    airAcceleration: 1000,
    speed: 1000,
  })
  for (const dt of [0, -1, Infinity, Number.NaN]) {
    motor.step(dt, {forward: true}, rotation)
    expect(motor.getState().velocity).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
  }
  motor.step(1 / 1000, {forward: true}, rotation)
  expect(motor.horizontalSpeed).toBeCloseTo(1)
  motor.step(100, {forward: true}, rotation)
  expect(motor.body.nextTranslation().z).toBeCloseTo(-2.55)
  expect(motor.horizontalSpeed).toBeCloseTo(2.55 / 100, 5)
})
test('nonfinite options and teleports fail before poisoning physics', () => {
  const motor = player()
  expect(() => motor.configure({speed: Number.NaN})).toThrow(RangeError)
  expect(() => motor.teleport([Infinity, 0, 0])).toThrow(RangeError)
  expect(motor.getState().position.x).toBe(0)
  expect(motor.getState().position.y).toBeCloseTo(0.04)
  expect(motor.getState().position.z).toBe(0)
})
test('disposing twice is safe and stops scheduling movement', () => {
  const motor = grounded()
  motor.dispose()
  motor.dispose()
  const position = motor.body.translation()
  tick(motor, {forward: true}, 30)
  expect(motor.body.translation()).toEqual(position)
})
test('teleport updates collider pose before the next controller query', () => {
  const motor = grounded()
  motor.teleport([8, 3, 7])
  expect(motor.body.collider(0).translation().x).toBe(8)
  expect(motor.body.collider(0).translation().y).toBeCloseTo(3.85)
  expect(motor.body.collider(0).translation().z).toBe(7)
})
test('autostep climbs a low ledge and can be disabled', () => {
  const motor = grounded()
  world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.075, 2), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.075, -3)))
  world.step()
  tick(motor, {forward: true}, 80)
  expect(motor.body.translation().z).toBeLessThan(-2)
  expect(motor.body.translation().y).toBeGreaterThan(0.15)
  motor.configure({stepHeight: 0})
  motor.teleport([0, 0.04, 0])
  tick(motor, {forward: true}, 80)
  expect(motor.body.translation().z).toBeGreaterThan(-1)
})
test('upward collision stops a jump at the ceiling', () => {
  const motor = grounded()
  world.createCollider(RAPIER.ColliderDesc.cuboid(3, 0.1, 3).setTranslation(0, 2.2, 0))
  world.step()
  let peak = 0
  for (let i = 0; i < 90; i++) {
    tick(motor, {jump: true})
    peak = Math.max(peak, motor.body.translation().y)
  }
  expect(peak).toBeGreaterThan(0.3)
  expect(peak).toBeLessThan(0.51)
  expect(motor.grounded).toBe(true)
})
const boostedDirections: Array<[string, EgoInput, 'dodge' | 'sprint']> = [
  ['forward', {forward: true}, 'sprint'],
  [
    'forward-left',
    {
      forward: true,
      left: true,
    },
    'sprint',
  ],
  [
    'forward-right',
    {
      forward: true,
      right: true,
    },
    'sprint',
  ],
  ['left', {left: true}, 'dodge'],
  ['right', {right: true}, 'dodge'],
  ['backward', {backward: true}, 'dodge'],
  [
    'backward-left',
    {
      backward: true,
      left: true,
    },
    'dodge',
  ],
  [
    'backward-right',
    {
      backward: true,
      right: true,
    },
    'dodge',
  ],
  [
    'canceled forward plus left',
    {
      forward: true,
      backward: true,
      left: true,
    },
    'dodge',
  ],
  [
    'canceled sideways plus forward',
    {
      forward: true,
      left: true,
      right: true,
    },
    'sprint',
  ],
]
test.each(boostedDirections)('%s uses its directional boost speed', (_name, input, mode) => {
  const motor = player({gravity: 0})
  tick(motor, {
    ...input,
    sprint: true,
  }, 120)
  const factor = mode === 'dodge' ? defaultEgoOptions.dodgeFactor : defaultEgoOptions.sprintFactor
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed * factor, 4)
})
test.each(boostedDirections)('%s uses its directional jump-height boost', (_name, input, mode) => {
  const motor = grounded()
  tick(motor, {
    ...input,
    sprint: true,
    jump: true,
  })
  const factor = mode === 'dodge' ? defaultEgoOptions.dodgeJumpFactor : defaultEgoOptions.sprintJumpFactor
  expect(motor.getState().velocity.y).toBeCloseTo(Math.sqrt(2 * defaultEgoOptions.gravity * defaultEgoOptions.jumpHeight * factor), 4)
})
test('dodge requires the boost action and crouching overrides it', () => {
  const motor = player({gravity: 0})
  tick(motor, {left: true}, 120)
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed, 4)
  tick(motor, {
    left: true,
    sprint: true,
    crouch: true,
  }, 120)
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed * defaultEgoOptions.crouchFactor, 4)
  tick(motor, {
    left: true,
    sprint: true,
  }, 120, false)
  expect(motor.horizontalSpeed).toBeCloseTo(0, 4)
})
test('crouch jumps do not stack with dodge bonuses', () => {
  const motor = grounded()
  tick(motor, {
    left: true,
    sprint: true,
    crouch: true,
    jump: true,
  })
  expect(motor.getState().velocity.y).toBeCloseTo(Math.sqrt(2 * defaultEgoOptions.gravity * defaultEgoOptions.jumpHeight * defaultEgoOptions.crouchJumpFactor), 4)
})
test('stationary and fully canceled input preserve the existing boosted standing jump', () => {
  const motor = grounded()
  tick(motor, {
    forward: true,
    backward: true,
    left: true,
    right: true,
    sprint: true,
    jump: true,
  })
  expect(motor.horizontalSpeed).toBeCloseTo(0, 4)
  expect(motor.getState().velocity.y).toBeCloseTo(Math.sqrt(2 * defaultEgoOptions.gravity * defaultEgoOptions.jumpHeight * defaultEgoOptions.sprintJumpFactor), 4)
})
test('dodge factors update independently and omitted values restore defaults', () => {
  const motor = grounded({
    dodgeFactor: 1.2,
    dodgeJumpFactor: 0.8,
  })
  tick(motor, {
    backward: true,
    sprint: true,
  }, 60)
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed * 1.2, 2)
  tick(motor, {
    backward: true,
    sprint: true,
    jump: true,
  })
  expect(motor.getState().velocity.y).toBeCloseTo(Math.sqrt(2 * defaultEgoOptions.gravity * defaultEgoOptions.jumpHeight * 0.8), 4)
  motor.configure({
    gravity: 0,
    dodgeFactor: undefined,
    dodgeJumpFactor: undefined,
  })
  tick(motor, {
    right: true,
    sprint: true,
  }, 120)
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed * defaultEgoOptions.dodgeFactor, 4)
})
test('switching between sprint and dodge retains smooth acceleration', () => {
  const motor = player({gravity: 0})
  tick(motor, {
    forward: true,
    sprint: true,
  }, 120)
  const before = motor.getState().velocity
  tick(motor, {
    right: true,
    sprint: true,
  })
  const after = motor.getState().velocity
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(defaultEgoOptions.airAcceleration * world.timestep, 4)
  tick(motor, {
    right: true,
    sprint: true,
  }, 120)
  expect(motor.horizontalSpeed).toBeCloseTo(defaultEgoOptions.speed * defaultEgoOptions.dodgeFactor, 4)
})
test.each([0, 0.01, 0.18, 2])('snap distance %s does not change grounded downward speed', snapToGround => {
  const ground = floor()
  const motor = player({snapToGround})
  tick(motor, {}, 30)
  expect(motor.grounded).toBe(true)
  // Remove the floor to observe the requested bias without contact corrections.
  world.removeCollider(ground, false)
  world.step()
  tick(motor)
  expect(motor.getState().velocity.y).toBeCloseTo(-defaultEgoOptions.groundStickSpeed, 5)
})
test.each([0, -0.5, 0.02, 0.18, 0.8])('ground stick speed %s is independent and has no hidden minimum', groundStickSpeed => {
  const ground = floor()
  const motor = player()
  tick(motor, {}, 30)
  expect(motor.grounded).toBe(true)
  motor.configure({groundStickSpeed})
  world.removeCollider(ground, false)
  world.step()
  tick(motor)
  expect(motor.getState().velocity.y).toBeCloseTo(-Math.max(groundStickSpeed, 0), 5)
})
test('ground stick speed can be reset to its default without respawning', () => {
  const ground = floor()
  const motor = player({groundStickSpeed: 0.8})
  tick(motor, {}, 30)
  expect(motor.grounded).toBe(true)
  motor.configure({groundStickSpeed: undefined})
  world.removeCollider(ground, false)
  world.step()
  tick(motor)
  expect(motor.getState().velocity.y).toBeCloseTo(-defaultEgoOptions.groundStickSpeed, 5)
})
test('ground sticking does not change jump launch or airborne gravity', () => {
  const motor = grounded({groundStickSpeed: 4})
  tick(motor, {jump: true})
  const launch = Math.sqrt(2 * defaultEgoOptions.gravity * defaultEgoOptions.jumpHeight)
  expect(motor.getState().velocity.y).toBeCloseTo(launch, 5)
  tick(motor, {jump: true})
  expect(motor.getState().velocity.y).toBeCloseTo(launch - defaultEgoOptions.gravity * world.timestep, 5)
})
test.each([Infinity, Number.NaN])('nonfinite ground stick speed %s is rejected', groundStickSpeed => {
  const motor = player()
  expect(() => motor.configure({groundStickSpeed})).toThrow(RangeError)
})
for (const fps of [30, 60, 120, 240]) {
  for (const sprint of [false, true]) {
    test(`a flight of stairs preserves horizontal momentum (${fps} Hz, sprint: ${sprint})`, () => {
      world.timestep = 1 / fps
      const motor = grounded()
      for (let i = 0; i < 20; i++) {
        const height = (i + 1) * 0.18
        world.createCollider(RAPIER.ColliderDesc.cuboid(2, height / 2, 0.18).setTranslation(0, height / 2, -1 - (i + 0.5) * 0.36))
      }
      world.createCollider(RAPIER.ColliderDesc.cuboid(2, 1.8, 2).setTranslation(0, 1.8, -10.2))
      world.step()
      let elapsed = 0
      let stalled = 0
      let longestStall = 0
      while (motor.body.translation().z > -8.8 && elapsed < 6) {
        const previousZ = motor.body.translation().z
        tick(motor, {
          forward: true,
          sprint,
        })
        elapsed += world.timestep
        if (!(elapsed > 0.2)) {
          continue
        }
        stalled = Math.abs(motor.body.translation().z - previousZ) < 0.001 ? stalled + world.timestep : 0
        longestStall = Math.max(longestStall, stalled)
      }
      expect(elapsed).toBeLessThan(sprint ? 1.7 : 4.2)
      expect(longestStall).toBeLessThan(0.035)
      expect(motor.body.translation().y).toBeCloseTo(3.62, 2)
      expect(motor.grounded).toBe(true)
    })
  }
}
test('restoring under a newly mounted low ceiling selects crouching before the first world step', () => {
  floor()
  const motor = player()
  const roofBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(4, 1.4, 0))
  world.createCollider(RAPIER.ColliderDesc.cuboid(1, 0.1, 1), roofBody)
  const destination: [number, number, number] = [4, 0.02, 0]
  const feet = motor.teleport(destination, [0, 0.04, 0])
  // It arrives where it was sent, which it tells in an array of its own.
  expect(feet).toEqual([4, 0.02, 0])
  expect(feet).not.toBe(destination)
  expect(motor.crouching).toBe(true)
  expect(motor.body.translation().x).toBe(4)
  expect(motor.body.collider(0).halfHeight()).toBeCloseTo(0.3)
  expect(motor.body.collider(0).translation().y).toBeCloseTo(0.62)
  tick(motor, {}, 10, false)
  expect(motor.crouching).toBe(true)
  roofBody.setTranslation({
    x: 10,
    y: 1.4,
    z: 0,
  }, true)
  world.step()
  tick(motor)
  expect(motor.crouching).toBe(false)
})
test('unsafe restore falls back only when even the crouched capsule cannot fit', () => {
  floor()
  const motor = player()
  world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2, 1).setTranslation(4, 1, 0))
  expect(motor.teleport([4, 0.02, 0], [0, 0.04, 0])).toEqual([0, 0.04, 0])
  expect(motor.body.translation()).toMatchObject({
    x: 0,
    z: 0,
  })
  expect(motor.crouching).toBe(false)
  const before = motor.getState()
  expect(() => motor.teleport([4, 0.02, 0])).toThrow(RangeError)
  expect(() => motor.teleport([4, 0.02, 0], [4, 0.04, 0])).toThrow(RangeError)
  expect(motor.getState()).toEqual(before)
})
test('a flying teleport goes anywhere upright, and a walking one lands where the capsule fits', () => {
  floor()
  const motor = player()
  world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2, 1).setTranslation(4, 1, 0))
  tick(motor, {crouch: true}, 30)
  expect(motor.crouching).toBe(true)
  // before any step flew
  expect(motor.teleport([4, 0.5, 0], [0, 0.04, 0], true)).toEqual([4, 0.5, 0])
  expect(motor.flying).toBe(true)
  expect(motor.crouching).toBe(false)
  expect(motor.body.collider(0).isEnabled()).toBe(false)
  expect(motor.body.translation()).toEqual({
    x: 4,
    y: 0.5,
    z: 0,
  })
  tick(motor, {}, 10, true, true)
  expect(motor.body.translation().y).toBe(0.5)
  // still flying by default
  motor.teleport([4, -3, 0])
  expect(motor.body.translation().y).toBe(-3)
  const before = motor.getState()
  expect(() => motor.teleport([4, 0.02, 0], undefined, false)).toThrow(RangeError)
  expect(motor.getState()).toEqual(before)
  expect(motor.teleport([4, 0.02, 0], [0, 0.04, 0], false)).toEqual([0, 0.04, 0])
  expect(motor.flying).toBe(false)
  expect(motor.body.collider(0).isEnabled()).toBe(true)
  expect(motor.body.translation().x).toBe(0)
  tick(motor, {}, 30)
  expect(motor.grounded).toBe(true)
})
test('restore clearance ignores sensors, disabled bodies and noninteracting groups before broad-phase updates', () => {
  floor()
  const motor = player({collisionGroups: 0x00_01_00_01})
  world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2, 1).setTranslation(4, 1, 0).setSensor(true))
  world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2, 1).setTranslation(4, 1, 0).setEnabled(false))
  world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2, 1).setTranslation(4, 1, 0).setCollisionGroups(0x00_02_00_02))
  const disabled = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(4, 1, 0).setEnabled(false))
  world.createCollider(RAPIER.ColliderDesc.cuboid(1, 2, 1), disabled)
  motor.teleport([4, 0, 0])
  expect(motor.body.translation().x).toBe(4)
  expect(motor.crouching).toBe(false)
})
for (const rate of [30, 60, 120, 240]) {
  test(`landing reports one pre-impact speed after a jump at ${rate} Hz, never initial placement`, () => {
    world.timestep = 1 / rate
    floor()
    const motor = player()
    for (let i = 0; i < rate; i++) {
      tick(motor)
      expect(motor.landingSpeed).toBe(0)
    }
    const impacts: Array<number> = []
    for (let i = 0; i < rate * 3; i++) {
      tick(motor, {jump: true})
      if (!(motor.landingSpeed > 0)) {
        continue
      }
      impacts.push(motor.landingSpeed)
      expect(motor.grounded).toBe(true)
      expect(motor.landingSpeed).toBeGreaterThan(3)
    }
    expect(impacts).toHaveLength(1)
    expect(motor.landingSpeed).toBe(0)
  })
}
test('teleport clears pending landing history and a one-tick ground interruption is silent', () => {
  const ground = floor()
  const motor = player()
  tick(motor, {}, 60)
  ground.setEnabled(false)
  tick(motor)
  ground.setEnabled(true)
  for (let i = 0; i < 30; i++) {
    tick(motor)
    expect(motor.landingSpeed).toBe(0)
  }
  tick(motor, {jump: true}, 10)
  motor.teleport([0, 0.04, 0])
  for (let i = 0; i < 60; i++) {
    tick(motor)
    expect(motor.landingSpeed).toBe(0)
  }
})
