import type {OrbitSettings} from '../../src/lib/camera/OrbitInspection.ts'

import {describe, expect, test} from 'bun:test'

import {PerspectiveCamera, Vector3} from 'three/webgpu'

import OrbitInspection, {inspectionFov} from '../../src/lib/camera/OrbitInspection.ts'

const center = new Vector3(0, 1, 0)
function setup() {
  const camera = new PerspectiveCamera(75, 16 / 9, 0.05, 200)
  camera.position.set(3, 1.05, 4)
  camera.lookAt(center)
  return {
    camera,
    orbit: new OrbitInspection(camera, center, {
      radius: 0.85,
      floorY: 0,
    }),
  }
}
function settle(orbit: OrbitInspection) {
  for (let i = 0; i < 300; i++) {
    orbit.update(center, 1 / 60)
  }
}
/** how much of the narrower half of the view the orbited sphere takes up, by angle, a little over 1 where it just overflows it */
function framing(camera: PerspectiveCamera) {
  const vertical = camera.fov * Math.PI / 180
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect)
  return Math.asin(0.85 / camera.position.distanceTo(center)) / (Math.min(vertical, horizontal) / 2)
}
function aimError(camera: PerspectiveCamera, target: Vector3) {
  return camera.getWorldDirection(new Vector3).angleTo(target.clone().sub(camera.position).normalize())
}
describe('hold-to-orbit camera', () => {
  test('approaches smoothly, narrows FOV, frames the Knot snugly and stays aimed at it', () => {
    const {camera, orbit} = setup()
    const original = camera.position.clone()
    orbit.update(center, 1 / 60)
    expect(camera.position.distanceTo(original)).toBeGreaterThan(0)
    expect(camera.position.distanceTo(original)).toBeLessThan(1)
    settle(orbit)
    expect(camera.fov).toBeCloseTo(inspectionFov, 5)
    expect(inspectionFov).toBeLessThan(75)
    expect(framing(camera)).toBeGreaterThan(0.95)
    expect(framing(camera)).toBeLessThan(1.1)
    expect(camera.getWorldDirection(new Vector3).dot(center.clone().sub(camera.position).normalize())).toBeGreaterThan(0.9999)
  })
  test('adjusts inspection distance within a wide bounded range', () => {
    const {camera, orbit} = setup()
    settle(orbit)
    const baseDistance = camera.position.distanceTo(center)
    expect(orbit.getProximity(center)).toBeCloseTo(0.6, 5)
    orbit.adjustDistance(-1)
    settle(orbit)
    expect(camera.position.distanceTo(center)).toBeCloseTo(baseDistance * 0.5, 5)
    expect(orbit.getProximity(center)).toBeCloseTo(1, 5)
    orbit.adjustDistance(2)
    settle(orbit)
    expect(camera.position.distanceTo(center)).toBeCloseTo(baseDistance * 1.75, 5)
    expect(orbit.getProximity(center)).toBeCloseTo(0, 5)
    orbit.adjustDistance(Number.NaN)
    settle(orbit)
    expect(camera.position.distanceTo(center)).toBeCloseTo(baseDistance * 1.75, 5)
  })
  test('orbits on both axes and returns around, not through, the object', () => {
    const {camera, orbit} = setup()
    const original = camera.position.clone()
    const rotation = camera.quaternion.clone()
    settle(orbit)
    const near = camera.position.clone()
    orbit.addInput(Math.PI, 0.3)
    settle(orbit)
    expect(camera.position.distanceTo(near)).toBeGreaterThan(2)
    expect(camera.position.y).toBeGreaterThan(near.y)
    orbit.release()
    let complete = false
    for (let i = 0; i < 300 && !complete; i++) {
      complete = orbit.update(center, 1 / 60)
      expect(camera.position.distanceTo(center)).toBeGreaterThan(0.85)
    }
    expect(complete).toBe(true)
    expect(camera.position.toArray()).toEqual(original.toArray())
    expect(camera.quaternion.toArray()).toEqual(rotation.toArray())
    expect(camera.fov).toBe(75)
  })
  test('clamps vertical orbit above the floor and ignores invalid input or time', () => {
    const {camera, orbit} = setup()
    orbit.addInput(0, -100)
    settle(orbit)
    expect(camera.position.y).toBeGreaterThanOrEqual(0.1799)
    const before = camera.position.clone()
    orbit.addInput(Number.NaN, Infinity)
    for (const delta of [0, -1, Number.NaN, Infinity]) {
      orbit.update(center, delta)
    }
    expect(camera.position.toArray()).toEqual(before.toArray())
    orbit.release()
    orbit.addInput(10, 10)
    settle(orbit)
    expect(camera.fov).toBe(75)
  })
  test('orbits on both axes above a floor that isn’t at zero, such as a plinth below the ground floor', () => {
    const camera = new PerspectiveCamera(75, 16 / 9, 0.05, 200)
    const raised = new Vector3(7.5, -9.7, -16.5)
    camera.position.set(4, -9.4, -16.7)
    camera.lookAt(raised)
    const orbit = new OrbitInspection(camera, raised, {
      radius: 0.24,
      floorY: -9.8,
    })
    for (let i = 0; i < 300; i++) {
      orbit.update(raised, 1 / 60)
    }
    const level = camera.position.y
    expect(level).toBeLessThan(raised.y + 0.5)
    orbit.addInput(0, 0.5)
    for (let i = 0; i < 300; i++) {
      orbit.update(raised, 1 / 60)
    }
    expect(camera.position.y).toBeGreaterThan(level + 0.1)
    orbit.addInput(0, -100)
    for (let i = 0; i < 300; i++) {
      orbit.update(raised, 1 / 60)
    }
    expect(camera.position.y).toBeGreaterThanOrEqual(-9.8 + 0.1799)
  })
  test('stays below a ceiling, such as Moonfall’s beams above its sculpture', () => {
    const {camera} = setup()
    const orbit = new OrbitInspection(camera, center, {
      radius: 0.85,
      ceilingY: 2,
    })
    orbit.addInput(0, 100)
    settle(orbit)
    expect(camera.position.y).toBeLessThanOrEqual(2 - 0.1799)
    expect(framing(camera)).toBeGreaterThan(0.95)
    expect(framing(camera)).toBeLessThan(1.1)
  })
  test('starts from a given direction at a given distance and keeps within its turn limits, as in front of a portrait', () => {
    const {camera} = setup()
    const orbit = new OrbitInspection(camera, center, {
      radius: 0.85,
      distance: 3,
      minDistance: 2,
      maxDistance: 4,
      facing: [0, 0, 1],
      yawLimit: 1.2,
      pitchLimit: 0.9,
    })
    settle(orbit)
    expect(camera.position.x).toBeCloseTo(0, 5)
    expect(camera.position.y).toBeCloseTo(1, 5)
    expect(camera.position.z).toBeCloseTo(3, 5)
    orbit.addInput(10, 10)
    settle(orbit)
    const offset = camera.position.clone().sub(center)
    expect(Math.atan2(offset.x, offset.z)).toBeCloseTo(1.2, 5)
    expect(Math.asin(offset.y / offset.length())).toBeCloseTo(0.9, 5)
    orbit.adjustDistance(-10)
    settle(orbit)
    expect(camera.position.distanceTo(center)).toBeCloseTo(2, 5)
    orbit.adjustDistance(10)
    settle(orbit)
    expect(camera.position.distanceTo(center)).toBeCloseTo(4, 5)
  })
  test('never spins around when the start direction lies where the orbit angle wraps, as for a portrait facing −z', () => {
    const camera = new PerspectiveCamera(62, 1.4, 0.1, 1000)
    const portrait = new Vector3(6.2, -5.9, -15.3)
    camera.position.set(3.7, -9.4, -18.8)
    camera.lookAt(portrait)
    const orbit = new OrbitInspection(camera, portrait, {
      radius: 1,
      distance: 3,
      facing: [Math.sin(Math.PI), 0, Math.cos(Math.PI)],
      yawLimit: 1.2,
      pitchLimit: 0.9,
    })
    let previous = Math.atan2(camera.position.x - portrait.x, camera.position.z - portrait.z)
    let turned = 0
    for (let i = 0; i < 300; i++) {
      orbit.addInput(i < 150 ? 0.01 : -0.01, 0)
      orbit.update(portrait, 1 / 60)
      const angle = Math.atan2(camera.position.x - portrait.x, camera.position.z - portrait.z)
      turned += Math.abs(Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous)))
      previous = angle
      expect(camera.position.z).toBeLessThan(portrait.z)
    }
    expect(turned).toBeLessThan(Math.PI)
  })
  test('keeps the Knot centered and at a steady distance during fast orbits', () => {
    const {camera, orbit} = setup()
    settle(orbit)
    const distance = camera.position.distanceTo(center)
    for (let i = 0; i < 120; i++) {
      // Flick-speed input: 20 rad/s yaw with alternating pitch.
      orbit.addInput(20 / 60, (i < 60 ? 6 : -6) / 60)
      orbit.update(center, 1 / 60)
      expect(aimError(camera, center)).toBeLessThan(1e-6)
      expect(camera.position.distanceTo(center)).toBeCloseTo(distance, 5)
    }
  })
  test('follows a moving Knot without letting it drift off-center', () => {
    const {camera, orbit} = setup()
    settle(orbit)
    const moving = center.clone()
    for (let i = 0; i < 60; i++) {
      moving.x += 0.05
      orbit.addInput(0.1, 0)
      orbit.update(moving, 1 / 60)
      expect(aimError(camera, moving)).toBeLessThan(1e-6)
    }
  })
  test('eases an initial aim offset out monotonically, independent of orbit input', () => {
    const {camera, orbit} = setup()
    camera.rotateY(0.4)
    let previous = aimError(camera, center)
    for (let i = 0; i < 120; i++) {
      orbit.addInput(0.2, 0)
      orbit.update(center, 1 / 60)
      const error = aimError(camera, center)
      expect(error).toBeLessThan(previous + 1e-6)
      previous = error
    }
    expect(previous).toBeLessThan(1e-4)
  })
  test('resumes orbiting from the current pose after an interrupted return', () => {
    const {camera, orbit} = setup()
    orbit.addInput(Math.PI / 2, 0)
    settle(orbit)
    orbit.release()
    for (let i = 0; i < 10; i++) {
      orbit.update(center, 1 / 60)
    }
    const before = camera.position.clone()
    orbit.returning = false
    orbit.update(center, 1 / 60)
    const step = camera.position.distanceTo(before)
    settle(orbit)
    // A smooth resume covers only a blend fraction of the way, never snapping to the orbit pose.
    expect(step).toBeGreaterThan(0)
    expect(step).toBeLessThan(camera.position.distanceTo(before) * 0.25)
    expect(aimError(camera, center)).toBeLessThan(1e-6)
  })
  test('keeps the same approach at different frame rates and supports portrait aspect ratios', () => {
    const a = setup()
    const b = setup()
    a.camera.aspect = 0.5
    b.camera.aspect = 0.5
    for (let i = 0; i < 60; i++) {
      a.orbit.update(center, 1 / 60)
    }
    for (let i = 0; i < 120; i++) {
      b.orbit.update(center, 1 / 120)
    }
    expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(1e-8)
    expect(a.camera.fov).toBeCloseTo(b.camera.fov, 8)
    expect(a.camera.position.distanceTo(center)).toBeGreaterThan(2)
  })
  test('circles on its own at its speed, holds off for its delay after the last input and keeps a set field of view, as behind the intro’s menu', () => {
    const {camera} = setup()
    const orbit = new OrbitInspection(camera, center, {
      radius: 0.85,
      distance: 5,
      pitchLimit: 0,
      fov: 75,
      autoRotation: {
        delay: 3,
        speed: 0.5,
      },
    })
    const angle = () => Math.atan2(camera.position.x - center.x, camera.position.z - center.z)
    const turned = (from: number) => Math.atan2(Math.sin(angle() - from), Math.cos(angle() - from))
    settle(orbit)
    const start = angle()
    const height = camera.position.y
    for (let i = 0; i < 60; i++) {
      orbit.update(center, 1 / 60)
    }
    expect(turned(start)).toBeCloseTo(0.5, 2)
    expect(camera.fov).toBe(75)
    expect(camera.position.y).toBeCloseTo(height, 5)
    expect(camera.position.distanceTo(center)).toBeCloseTo(5, 5)
    orbit.addInput(-0.4, 0)
    // It follows the input within 2.5 s, and still holds there half a second later.
    for (let i = 0; i < 150; i++) {
      orbit.update(center, 1 / 60)
    }
    const held = angle()
    for (let i = 0; i < 29; i++) {
      orbit.update(center, 1 / 60)
    }
    expect(turned(held)).toBeCloseTo(0, 3)
    // From 3 s on, it circles again.
    for (let i = 0; i < 60; i++) {
      orbit.update(center, 1 / 60)
    }
    expect(turned(held)).toBeGreaterThan(0.3)
    expect(camera.position.y).toBeCloseTo(height, 5)
  })
  describe('rocking', () => {
    const rocking = {
      nod: 0.12,
      pace: 0.4,
      sway: 0.54,
    }
    function rockingSetup(settings: Partial<OrbitSettings> = {}) {
      const {camera} = setup()
      const orbit = new OrbitInspection(camera, center, {
        radius: 0.85,
        distance: 3,
        facing: [0, 0, 1],
        yawLimit: 1.2,
        pitchLimit: 0.9,
        rocking,
        ...settings,
      })
      orbit.settle(center)
      /** the camera’s yaw and pitch around the center, in radians */
      const angles = () => {
        const offset = camera.position.clone().sub(center)
        return {
          yaw: Math.atan2(offset.x, offset.z),
          pitch: Math.asin(offset.y / offset.length()),
        }
      }
      const run = (seconds: number, each?: () => void) => {
        for (let i = 0; i < Math.round(seconds * 60); i++) {
          orbit.update(center, 1 / 60)
          each?.()
        }
      }
      return {
        camera,
        orbit,
        angles,
        run,
      }
    }
    test('holds still until asked to rock, and an orbit without a rock never rocks', () => {
      const {orbit, angles, run} = rockingSetup()
      run(3)
      expect(angles().yaw).toBeCloseTo(0, 9)
      const plain = rockingSetup({rocking: undefined})
      plain.orbit.rock(1)
      plain.run(3)
      expect(plain.angles().yaw).toBeCloseTo(0, 9)
      orbit.rock(1)
      run(1)
      expect(angles().yaw).toBeGreaterThan(0.2)
    })
    test('sways and nods in a figure of two sways to three nods, a sway every π divided by its pace', () => {
      const {orbit, angles, run} = rockingSetup()
      orbit.rock(1)
      const yaws: Array<number> = []
      const pitches: Array<number> = []
      run(Math.PI / rocking.pace, () => {
        yaws.push(angles().yaw)
        pitches.push(angles().pitch)
      })
      // The camera eases after its target, so the extremes fall a little short of the figure’s.
      expect(Math.max(...yaws)).toBeGreaterThan(rocking.sway * 0.95)
      expect(Math.max(...yaws)).toBeLessThanOrEqual(rocking.sway)
      expect(Math.min(...yaws)).toBeLessThan(-rocking.sway * 0.95)
      expect(Math.max(...pitches)).toBeGreaterThan(rocking.nod * 0.9)
      expect(Math.min(...pitches)).toBeLessThan(-rocking.nod * 0.9)
      const crossings = (values: Array<number>) => values.map(Math.sign).filter(Boolean).filter((value, index, all) => index && value !== all[index - 1]).length
      expect(crossings(yaws)).toBe(1)
      expect(crossings(pitches)).toBe(2)
    })
    test('goes through its figure as many times faster as its speed, keeping its place when the speed changes', () => {
      const a = rockingSetup()
      const b = rockingSetup()
      a.orbit.rock(1)
      a.run(2)
      b.orbit.rock(2)
      b.run(0.5)
      b.orbit.rock(0.5)
      b.run(2)
      // 1 s at 2× and 1 s at 0.5× in 2.5 s, against 2 s at 1×
      expect(b.angles().yaw).toBeCloseTo(a.angles().yaw, 2)
      expect(b.angles().pitch).toBeCloseTo(a.angles().pitch, 2)
    })
    test('stops where it rocked to and sets off from there anew', () => {
      const {orbit, angles, run} = rockingSetup()
      orbit.rock(1)
      run(1.5)
      const target = Math.sin(2 * 1.5 * rocking.pace) * rocking.sway
      orbit.rock(0)
      run(3)
      const stopped = angles()
      expect(stopped.yaw).toBeCloseTo(target, 3)
      orbit.rock(1)
      const yaws: Array<number> = []
      run(Math.PI / rocking.pace, () => yaws.push(angles().yaw - stopped.yaw))
      expect(Math.max(...yaws)).toBeGreaterThan(0.3)
      expect(Math.min(...yaws)).toBeLessThan(-0.3)
    })
    test('puts its turn into the pose an input turns from', () => {
      const {orbit, angles, run} = rockingSetup()
      orbit.rock(1)
      run(1.5)
      const target = Math.sin(2 * 1.5 * rocking.pace) * rocking.sway
      orbit.addInput(0.1, 0)
      orbit.rock(0)
      run(3)
      expect(angles().yaw).toBeCloseTo(target + 0.1, 3)
    })
    test('set off near a limit, moves its figure over to end right at the limit instead of running into it', () => {
      const {orbit, angles, run} = rockingSetup({
        yawLimit: 0.6,
        pitchLimit: 0.2,
      })
      orbit.addInput(0.5, 0.15)
      run(1)
      orbit.rock(1)
      const yaws: Array<number> = []
      const pitches: Array<number> = []
      run(Math.PI / rocking.pace, () => {
        yaws.push(angles().yaw)
        pitches.push(angles().pitch)
      })
      // as wide as ever, from the limit on
      expect(Math.max(...yaws)).toBeLessThanOrEqual(0.6 + 1e-9)
      expect(Math.max(...yaws)).toBeGreaterThan(0.59)
      expect(Math.min(...yaws)).toBeLessThan(0.6 - 2 * rocking.sway + 0.01)
      expect(Math.max(...pitches)).toBeLessThanOrEqual(0.2 + 1e-9)
      expect(Math.max(...pitches)).toBeGreaterThan(0.19)
      expect(Math.min(...pitches)).toBeLessThan(0.2 - 2 * rocking.nod + 0.01)
      // Running into the limit would hold it there for a while.
      expect(yaws.filter(yaw => yaw > 0.595).length).toBeLessThan(yaws.length / 20)
    })
    test('sets off from where it is, without a jump', () => {
      const {orbit, angles, run} = rockingSetup({yawLimit: 0.6})
      orbit.addInput(0.6, 0)
      run(1)
      const before = angles().yaw
      orbit.rock(1)
      run(1 / 60)
      expect(Math.abs(angles().yaw - before)).toBeLessThan(0.005)
      run(1)
      expect(angles().yaw).toBeLessThan(before - 0.05)
    })
    test('narrows to the room between limits closer than its width', () => {
      const {orbit, angles, run} = rockingSetup({yawLimit: 0.3})
      orbit.rock(1)
      const yaws: Array<number> = []
      run(Math.PI / rocking.pace, () => yaws.push(angles().yaw))
      expect(Math.max(...yaws)).toBeLessThanOrEqual(0.3 + 1e-9)
      expect(Math.max(...yaws)).toBeGreaterThan(0.29)
      expect(Math.min(...yaws)).toBeGreaterThanOrEqual(-0.3 - 1e-9)
      expect(Math.min(...yaws)).toBeLessThan(-0.29)
    })
    test('returns to the player exactly, wherever it rocked', () => {
      const {camera} = setup()
      const original = camera.position.clone()
      const rotation = camera.quaternion.clone()
      const orbit = new OrbitInspection(camera, center, {
        radius: 0.85,
        rocking,
      })
      orbit.rock(4)
      for (let i = 0; i < 150; i++) {
        orbit.update(center, 1 / 60)
      }
      orbit.release()
      let complete = false
      for (let i = 0; i < 600 && !complete; i++) {
        complete = orbit.update(center, 1 / 60)
      }
      expect(complete).toBe(true)
      expect(camera.position.toArray()).toEqual(original.toArray())
      expect(camera.quaternion.toArray()).toEqual(rotation.toArray())
    })
  })
})
