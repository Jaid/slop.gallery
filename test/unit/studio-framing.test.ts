import type {OrbitSettings} from '../../src/lib/camera/OrbitInspection.ts'

import {describe, expect, test} from 'bun:test'

import {Box3, PerspectiveCamera, Vector3} from 'three/webgpu'

import OrbitInspection from '../../src/lib/camera/OrbitInspection.ts'
import {boxClearance, clearance, fitDistance, studioFov, subjectRadius, viewFill} from '../../src/lib/rendering/studio/studioFraming.ts'

/** a framed work, a wide one and a tall one, and something as deep as it is wide */
const sizes = [
  {
    width: 2.2,
    height: 2.2,
    depth: 0.15,
  },
  {
    width: 3.4,
    height: 1.9,
    depth: 0.12,
  },
  {
    width: 1.2,
    height: 2.1,
    depth: 0.2,
  },
  {
    width: 0.6,
    height: 0.6,
    depth: 0.6,
  },
] as const
const aspects = [0.6, 1, 1.4, 2.4]
const origin = new Vector3
const front = new Vector3(0, 0, 1)
/** A camera that looks at the origin from the direction at the distance. */
const look = (direction: Vector3, distance: number, aspect: number) => {
  const camera = new PerspectiveCamera(studioFov, aspect, 0.001, 100)
  camera.position.copy(direction).multiplyScalar(distance)
  camera.lookAt(origin)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return camera
}
/** the eight corners of the box of the size around the origin */
const corners = ({depth, height, width}: typeof sizes[number]) => [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => new Vector3(x * width / 2, y * height / 2, z * depth / 2))))
/** unit directions all round, the axes among them */
const directions = () => {
  const result = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(-1, 0, 0), new Vector3(0, -1, 0), new Vector3(0, 0, -1)]
  for (let index = 0; index < 400; index++) {
    // a Fibonacci sphere
    const y = 1 - (index + 0.5) / 200
    const ring = Math.sqrt(1 - y * y)
    const turn = index * Math.PI * (3 - Math.sqrt(5))
    result.push(new Vector3(Math.cos(turn) * ring, y, Math.sin(turn) * ring))
  }
  return result
}
describe('framing an object in a studio', () => {
  test('the sphere around an object reaches its corners', () => {
    for (const size of sizes) {
      const radius = subjectRadius(size)
      for (const corner of corners(size)) {
        expect(corner.length()).toBeCloseTo(radius, 10)
      }
    }
  })
  test('from straight in front, the object’s front fills the same share of the view’s tighter side, whatever the shapes of both', () => {
    for (const size of sizes) {
      for (const aspect of aspects) {
        const camera = look(front, fitDistance(size, front, aspect), aspect)
        // The corner of the front, in the view from −1 to 1.
        const corner = new Vector3(size.width / 2, size.height / 2, size.depth / 2)
        corner.project(camera)
        expect(Math.max(corner.x, corner.y)).toBeCloseTo(viewFill, 10)
        expect(Math.min(corner.x, corner.y)).toBeLessThanOrEqual(viewFill + 1e-10)
      }
    }
  })
  test('from every side, all of the object lies within that share of the view, its farthest corner right on the edge of it', () => {
    for (const size of sizes) {
      for (const aspect of aspects) {
        for (const direction of directions()) {
          // Looking straight down or up, three’s lookAt turns the view 0.0001 radians off its target to tell its sides apart, so that camera wouldn’t look at the middle; an orbit never gets there. See the next test for these two.
          if (Math.abs(direction.y) === 1) {
            continue
          }
          const camera = look(direction, fitDistance(size, direction, aspect), aspect)
          let reach = 0
          for (const corner of corners(size)) {
            corner.project(camera)
            // In front of the camera.
            expect(corner.z).toBeLessThan(1)
            reach = Math.max(reach, Math.abs(corner.x), Math.abs(corner.y))
          }
          expect(reach).toBeCloseTo(viewFill, 8)
        }
      }
    }
  })
  test('from straight above and below, the object fits by its width and its depth, from its near side on', () => {
    const slope = Math.tan(studioFov * Math.PI / 360) * viewFill
    for (const size of sizes) {
      for (const aspect of aspects) {
        const expected = size.height / 2 + Math.max(size.width / aspect, size.depth) / 2 / slope
        expect(fitDistance(size, new Vector3(0, 1, 0), aspect)).toBeCloseTo(expected, 10)
        expect(fitDistance(size, new Vector3(0, -1, 0), aspect)).toBeCloseTo(expected, 10)
      }
    }
  })
  test('a narrower view moves the camera away, as does a side of the object coming toward it', () => {
    const [work] = sizes
    expect(fitDistance(work, front, 0.6)).toBeGreaterThan(fitDistance(work, front, 1))
    expect(fitDistance(work, front, 2.4)).toBe(fitDistance(work, front, 1))
    // Turned halfway to its edge, one side of something flat is much nearer than its middle.
    const turned = new Vector3(1, 0, 1)
    turned.normalize()
    expect(fitDistance(work, turned, 1)).toBeGreaterThan(fitDistance(work, front, 1))
    // Edge-on, it is as far as its height takes, from its near edge on.
    expect(fitDistance(work, new Vector3(1, 0, 0), 2.4)).toBeCloseTo(work.height / 2 / Math.tan(studioFov * Math.PI / 360) / viewFill + work.width / 2, 10)
  })
  test('the least distance keeps all of the object in front of the camera from every side, and lets it close to something flat', () => {
    for (const size of sizes) {
      const keepOut = boxClearance(size)
      const margin = subjectRadius(size) * clearance
      for (const direction of directions()) {
        const distance = keepOut(direction)
        // How far in front of the camera, which looks at the middle, the nearest corner lies.
        const nearest = Math.min(...corners(size).map(corner => distance - corner.dot(direction)))
        expect(nearest).toBeCloseTo(margin, 10)
      }
      // In front of a flat object, that is its front, far inside the sphere around it.
      expect(keepOut(new Vector3(0, 0, 1))).toBeCloseTo(size.depth / 2 + margin, 10)
      expect(keepOut(new Vector3(1, 0, 0))).toBeCloseTo(size.width / 2 + margin, 10)
    }
  })
})
describe('an orbit around an object in a studio', () => {
  const [, wide] = sizes
  const aspect = 1.4
  const setup = () => {
    const camera = new PerspectiveCamera(studioFov, aspect, 0.01, 100)
    camera.position.set(4, 3, -9)
    const settings: OrbitSettings = {
      radius: subjectRadius(wide),
      facing: [0, 0, 1],
      fov: studioFov,
      keepOut: boxClearance(wide),
      distanceToward: direction => fitDistance(wide, direction, camera.aspect),
    }
    return {
      camera,
      settings,
      orbit: new OrbitInspection(camera, origin, settings),
    }
  }
  /** how far the corner of the object farthest out lies from the middle of the camera’s view, 1 being the view’s edge */
  const reachIn = (camera: PerspectiveCamera) => {
    camera.updateMatrixWorld()
    return Math.max(...corners(wide).map(corner => {
      corner.project(camera)
      return Math.max(Math.abs(corner.x), Math.abs(corner.y))
    }))
  }
  test('settles straight in front of the object at once, from wherever the camera was', () => {
    const {camera, orbit} = setup()
    orbit.settle(origin)
    expect(camera.position.x).toBeCloseTo(0, 10)
    expect(camera.position.y).toBeCloseTo(0, 10)
    expect(camera.position.z).toBeCloseTo(fitDistance(wide, front, aspect), 10)
    expect(camera.fov).toBe(studioFov)
    expect(camera.getWorldDirection(new Vector3).z).toBeCloseTo(-1, 10)
    // Nothing is left to ease to.
    const before = camera.position.clone()
    orbit.update(origin, 1 / 60)
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-9)
  })
  test('keeps all of the object in view while it turns, all the way round and over the top', () => {
    const {camera, orbit} = setup()
    orbit.settle(origin)
    expect(reachIn(camera)).toBeCloseTo(viewFill, 8)
    let farthestTurn = 0
    let highest = 0
    for (let step = 0; step < 900; step++) {
      // Around, then up and over while still turning.
      orbit.addInput(0.02, step > 300 ? 0.004 : 0)
      orbit.update(origin, 1 / 60)
      // The view lags a little behind a fast orbit, which the margin around the object takes.
      expect(reachIn(camera)).toBeLessThan(1)
      farthestTurn = Math.max(farthestTurn, Math.abs(Math.atan2(camera.position.x, camera.position.z)))
      highest = Math.max(highest, camera.position.y)
    }
    // It got behind the object, where the wall is in the world, and well above it.
    expect(farthestTurn).toBeGreaterThan(3)
    expect(highest).toBeGreaterThan(wide.height)
    // At rest again, the object fits exactly, wherever the camera ended up.
    for (let step = 0; step < 300; step++) {
      orbit.update(origin, 1 / 60)
    }
    expect(reachIn(camera)).toBeCloseTo(viewFill, 6)
  })
  test('moves closer and away by a share of that distance, on every side', () => {
    const {camera, orbit} = setup()
    orbit.settle(origin)
    const fitted = camera.position.length()
    orbit.adjustDistance(0.5)
    for (let step = 0; step < 300; step++) {
      orbit.update(origin, 1 / 60)
    }
    expect(camera.position.length()).toBeCloseTo(fitted * 1.5, 6)
    // Turned to its edge, it is still half again as far as the object fits from there.
    orbit.addInput(Math.PI / 2, 0)
    for (let step = 0; step < 300; step++) {
      orbit.update(origin, 1 / 60)
    }
    expect(camera.position.x).toBeCloseTo(fitDistance(wide, new Vector3(1, 0, 0), aspect) * 1.5, 5)
    expect(Math.abs(camera.position.z)).toBeLessThan(1e-5)
  })
  test('never gets its lens into the box around the object, however close and however turned', () => {
    const {camera, orbit, settings} = setup()
    settings.minDistance = 1e-3
    orbit.settle(origin)
    // As close as it gets.
    orbit.adjustDistance(-10)
    const box = new Box3(new Vector3(-wide.width / 2, -wide.height / 2, -wide.depth / 2), new Vector3(wide.width / 2, wide.height / 2, wide.depth / 2))
    const margin = subjectRadius(wide) * clearance
    const forward = new Vector3
    let closest = Infinity
    for (let step = 0; step < 900; step++) {
      orbit.addInput(0.02, step > 300 ? 0.004 : 0)
      orbit.update(origin, 1 / 60)
      camera.getWorldDirection(forward)
      // The corner nearest to the camera along its view, which a near plane would cut first.
      closest = Math.min(closest, ...corners(wide).map(corner => corner.sub(camera.position).dot(forward)))
      expect(box.containsPoint(camera.position)).toBe(false)
    }
    // The view lags a little behind a fast orbit, so the nearest corner gets a little nearer than at rest.
    expect(closest).toBeGreaterThan(margin / 2)
    expect(closest).toBeLessThan(margin * 1.5)
  })
  test('follows a view that changes its shape meanwhile', () => {
    const {camera, orbit} = setup()
    orbit.settle(origin)
    const wideView = camera.position.z
    camera.aspect = 0.6
    camera.updateProjectionMatrix()
    orbit.settle(origin)
    expect(camera.position.z).toBeCloseTo(fitDistance(wide, front, 0.6), 10)
    expect(camera.position.z).toBeGreaterThan(wideView)
    expect(reachIn(camera)).toBeCloseTo(viewFill, 8)
  })
})
