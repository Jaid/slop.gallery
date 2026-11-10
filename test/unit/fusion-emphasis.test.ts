import type {Shot} from '../../scripts/lib/fusionCamera.ts'
import type {Landing, ResultClosing} from '../../scripts/lib/fusionEmphasis.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {describe, expect, test} from 'bun:test'

import {Euler, PerspectiveCamera, Quaternion, Vector3} from 'three'

import {radians, shotAngles} from '../../scripts/lib/fusionCamera.ts'
import {emphasized, fitShot, outermost, partyShot, resultShot} from '../../scripts/lib/fusionEmphasis.ts'
import {partyClosing, partyViews, resultClosing} from '../../scripts/renderFusion.ts'
import {classicFrame} from '../../src/frames/index.ts'
import {offsetPosition} from '../../src/lib/gallery/fusion/effects/base/portalOffset.ts'
import {bloodEffect} from '../../src/lib/gallery/fusion/effects/index.ts'
import {portalIn} from '../../src/lib/gallery/fusion/portalFrame.ts'
import {fusionTiming} from '../../src/lib/gallery/fusion/timing.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

/** the game’s camera as slopGallery.pose turns it for the shot, square */
const cameraOf = (shot: Shot) => {
  const {pitch, yaw} = shotAngles(shot)
  const camera = new PerspectiveCamera(shot.fov, 1, 0.01, 100)
  camera.position.set(...shot.position)
  camera.quaternion.setFromEuler(new Euler(radians(pitch), radians(yaw), radians(shot.roll), 'YXZ'))
  camera.updateMatrixWorld()
  return camera
}
/** where the point shows in the shot, from −1 to 1 across and up the view */
const project = (shot: Shot, point: Vec3) => {
  const at = new Vector3(...point)
  at.project(cameraOf(shot))
  return [at.x, at.y] as const
}
const timeline = {
  throwAt: 1,
  strike: 1.45,
  emergence: 14.95,
  end: 20,
}
const sameShot = (a: Shot, b: Shot, digits = 9) => {
  for (const field of ['position', 'target'] as const) {
    for (const axis of [0, 1, 2]) {
      expect(a[field][axis]).toBeCloseTo(b[field][axis], digits)
    }
  }
  expect(a.fov).toBeCloseTo(b.fov, digits)
  expect(a.roll).toBeCloseTo(b.roll, digits)
}
const slot = sandbox.portraitSlots().find(candidate => candidate.id === 'cell-south_2')!
const portal = portalIn(slot, sandbox)
const cell = sandbox.roomById('cell')!
const framing = {
  aspect: 1,
  ceiling: cell.floorY + cell.height,
  portal,
  world: sandbox,
}
describe('fitting a shot to points', () => {
  const cloud: Array<Vec3> = Array.from({length: 200}, (_, index) => [Math.sin(index * 12.9898) * 1.4, 1 + Math.abs(Math.sin(index * 78.233)) * 1.8, 3 + Math.cos(index * 39.425) * 0.9])
  test('sees every point within the share of the view it fills, from as close as that allows', () => {
    for (const look of [[0, -0.2, 1], [0.5, -0.5, 0.7], [-1, 0.1, 0.3]] as Array<Vec3>) {
      for (const fov of [40, 55, 80]) {
        const shot = fitShot(cloud, look, fov, 1, 0.9)
        const spots = cloud.map(point => project(shot, point))
        const edge = Math.max(...spots.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]))
        // touching the share of the view on its tighter axis, and nothing beyond it
        expect(edge).toBeCloseTo(0.9, 6)
        expect(shot.roll).toBe(0)
      }
    }
  })
  test('keeps few of a cloud’s points, which hold all of it', () => {
    const kept = outermost(cloud)
    expect(kept.length).toBeLessThan(cloud.length)
    const look: Vec3 = [0.2, -0.3, 1]
    const tight = fitShot(cloud, look, 50, 1)
    const loose = fitShot(kept, look, 50, 1)
    expect(Math.hypot(...loose.position.map((value, axis) => value - tight.position[axis]))).toBeLessThan(0.05)
  })
})
describe('--emphasis party', () => {
  const closing = partyClosing(partyViews(portal, bloodEffect, timeline), timeline, framing)
  const floor = portal.floor - portal.center[1]
  test('keeps everything the Horror Orb’s blood still reaches in view all through its drift, from inside the Cell, pushing in once, calmly, as it settles', () => {
    for (let time = timeline.emergence; time <= timeline.end; time += 1 / 30) {
      const shot = partyShot(closing, time, timeline)
      const since = time - timeline.emergence
      const coming = [...since < fusionTiming.afterglow ? Array.from({length: 8}, (_, index): [number, number, number] => [Math.cos(index * Math.PI / 4) * portal.radius, Math.sin(index * Math.PI / 4) * portal.radius, 0]) : [], ...bloodEffect.extent(floor, since)].map(offset => offsetPosition(portal, offset))
      expect(coming.length).toBeGreaterThan(0)
      for (const point of coming) {
        const [x, y] = project(shot, point)
        expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThan(1)
      }
      // The Cell is 18 × 10 m round its middle and 4 m high.
      expect(Math.abs(shot.position[0])).toBeLessThan(9)
      expect(Math.abs(shot.position[2])).toBeLessThan(5)
      expect(shot.position[1]).toBeGreaterThan(0.3)
      expect(shot.position[1]).toBeLessThan(framing.ceiling)
    }
    // It looks from in front of the work, and closer once the jets and the portal are over.
    expect(closing.from[2] * portal.normal[2]).toBeGreaterThan(0.9)
    const reach = (time: number) => {
      const shot = partyShot(closing, time, timeline)
      return Math.hypot(...shot.position.map((value, axis) => value - shot.target[axis]))
    }
    expect(reach(timeline.end)).toBeLessThan(reach(timeline.emergence) * 0.8)
    // It only ever comes closer, over a few seconds, never faster than a slow walk.
    const {move} = closing
    expect(move!.to - move!.from).toBeGreaterThan(2)
    for (let time = timeline.emergence; time < timeline.end; time += 1 / 60) {
      expect(reach(time + 1 / 60)).toBeLessThanOrEqual(reach(time) + 1e-3)
      const [before, after] = [partyShot(closing, time, timeline), partyShot(closing, time + 1 / 60, timeline)]
      expect(Math.hypot(...after.position.map((value, axis) => value - before.position[axis])) * 60).toBeLessThan(1.2)
    }
  })
  test('takes over from the camera’s path as the result flips out, smoothly, and holds the party from a moment later', () => {
    const base: Shot = {
      position: [3, 2.5, 0],
      target: [0, 2, 3.3],
      fov: 70,
      roll: -4,
    }
    expect(emphasized(base, closing, timeline.emergence - 0.5, timeline)).toEqual(base)
    expect(emphasized(base, undefined, timeline.end, timeline)).toEqual(base)
    sameShot(emphasized(base, closing, timeline.end, timeline), partyShot(closing, timeline.end, timeline))
    let previous = emphasized(base, closing, timeline.emergence, timeline)
    for (let time = timeline.emergence; time <= timeline.end; time += 1 / 60) {
      const shot = emphasized(base, closing, time, timeline)
      expect(Math.hypot(...shot.position.map((value, axis) => value - previous.position[axis]))).toBeLessThan(0.06)
      previous = shot
    }
  })
})
describe('--emphasis result', () => {
  /** lying face up on the Cell’s floor with its top toward the room, a little tilted and turned */
  const lying = new Quaternion
  lying.setFromEuler(new Euler(-Math.PI / 2 + 0.01, 0.4, 0.006, 'YXZ'))
  const landing: Landing = {
    width: 1.2,
    height: 0.8,
    position: [-0.6, 0.06, 3.2],
    quaternion: lying.toArray(),
    settled: 16.5,
    track: Array.from({length: 40}, (_, index) => ({
      time: 15 + index * 0.05,
      position: [-0.6 * index / 39, 2 - 1.94 * index / 39, 3.3 - 0.1 * index / 39] as Vec3,
      quaternion: lying.toArray(),
    })),
  }
  const closing: ResultClosing = resultClosing(landing, framing)
  test('ends looking straight at the result’s image, upright, filling the view up to its frame’s sight edge, as viewing a portrait with V does', () => {
    const last = resultShot(closing, timeline.end, timeline)
    const camera = cameraOf(last)
    const look = camera.getWorldDirection(new Vector3)
    expect(look.dot(new Vector3(...closing.normal))).toBeCloseTo(-1, 9)
    const top = new Vector3(0, 1, 0)
    top.applyQuaternion(lying)
    const right = new Vector3(1, 0, 0)
    right.applyQuaternion(lying)
    // what its frame leaves in sight of its image
    const opening = classicFrame.opening(landing.width, landing.height, closing.aligned.distance)
    expect(opening.width).toBeLessThan(landing.width - 0.005)
    const corner = (x: number, y: number): Vec3 => {
      const point = new Vector3(...closing.center)
      return point.addScaledVector(right, x * opening.width / 2).addScaledVector(top, y * opening.height / 2).toArray()
    }
    // its wider side spans the view, the frame’s sight edge just outside it, its top at the top, straight
    const edge = project(last, corner(1, 1))[0]
    expect(edge).toBeCloseTo(1 / 0.997, 6)
    expect(project(last, corner(-1, 1))[0]).toBeCloseTo(-edge, 6)
    expect(project(last, corner(1, 1))[1]).toBeCloseTo(project(last, corner(-1, 1))[1], 6)
    expect(project(last, corner(1, 1))[1]).toBeCloseTo(edge * opening.height / opening.width, 6)
    expect(project(last, corner(1, -1))[1]).toBeCloseTo(-edge * opening.height / opening.width, 6)
    expect(last.fov).toBe(50)
  })
  test('follows the result down and cranes up over it without a jolt', () => {
    let previous = resultShot(closing, timeline.emergence, timeline)
    let previousLook = cameraOf(previous).quaternion
    for (let time = timeline.emergence; time <= timeline.end + 1e-9; time += 1 / 60) {
      const shot = resultShot(closing, time, timeline)
      const turn = cameraOf(shot).quaternion
      expect(Math.hypot(...shot.position.map((value, axis) => value - previous.position[axis]))).toBeLessThan(0.03)
      // the whole orientation, roll included, turns less than 2° a frame even where it looks almost straight down
      expect(turn.angleTo(previousLook)).toBeLessThan(radians(2))
      previous = shot
      previousLook = turn
    }
  })
  test('lies still before the camera sets off over it, which steadies it at the end of the film', () => {
    const base: Shot = {
      position: [1, 2.5, 0],
      target: [0, 2, 3.3],
      fov: 60,
      roll: 3,
    }
    sameShot(emphasized(base, closing, timeline.end, timeline), resultShot(closing, timeline.end, timeline))
    // It turns to follow the result at once, while it stands its ground for a moment.
    const early = emphasized(base, closing, timeline.emergence + 0.45, timeline)
    sameShot(early, {
      ...base,
      target: resultShot(closing, timeline.emergence + 0.45, timeline).target,
    })
  })
})
