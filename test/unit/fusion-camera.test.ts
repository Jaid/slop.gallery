import type {CameraKey} from '../../scripts/lib/fusionCamera.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {Euler, PerspectiveCamera, Vector3} from 'three'

import {holdPoint, keyedShot, parseCameraPath, radians, shotAngles} from '../../scripts/lib/fusionCamera.ts'

const keys: Array<CameraKey> = [
  {
    time: 0,
    position: [0, 1.6, 4],
    target: [0, 1.5, 0],
    fov: 50,
    roll: 0,
  },
  {
    time: 2,
    position: [3, 2, 3],
    target: [0.5, 1.5, 0],
    fov: 60,
    roll: -5,
  },
  {
    time: 5,
    position: [-2, 2.4, 2],
    target: [0, 1, 0],
    fov: 44,
    roll: 3,
  },
]
test('a keyed camera path passes through its keys and holds still before the first and after the last', () => {
  for (const {time, ...shot} of keys) {
    const at = keyedShot(keys, time)
    for (const field of ['position', 'target'] as const) {
      for (const axis of [0, 1, 2]) {
        expect(at[field][axis]).toBeCloseTo(shot[field][axis], 9)
      }
    }
    expect(at.fov).toBeCloseTo(shot.fov, 9)
    expect(at.roll).toBeCloseTo(shot.roll, 9)
  }
  expect(keyedShot(keys, -3)).toEqual(keyedShot(keys, 0))
  expect(keyedShot(keys, 9)).toEqual(keyedShot(keys, 5))
})
test('a camera path from the editor needs keys in order that look somewhere, and the film’s end', () => {
  const path = parseCameraPath({
    end: 6,
    emphasis: 'party',
    keys: keys.map(key => ({
      ...key,
      id: 'dropped',
    })),
  })
  expect(path.handheld).toBe(true)
  expect(path.keys[0]).toEqual(keys[0])
  expect(parseCameraPath({
    end: 6,
    handheld: false,
    keys,
    note: 'closer at the burst',
  })).toMatchObject({
    handheld: false,
    note: 'closer at the burst',
  })
  expect(() => parseCameraPath({keys})).toThrow('end')
  expect(() => parseCameraPath({
    end: 6,
    keys: [],
  })).toThrow('at least one key')
  expect(() => parseCameraPath({
    end: 6,
    keys: keys.toReversed(),
  })).toThrow('Key 1')
  expect(() => parseCameraPath({
    end: 6,
    keys: [{
      ...keys[0],
      target: keys[0].position,
    }],
  })).toThrow('looks at where it is')
})
/** where the game’s camera holds an orb: 0.55 m out and 15° below the middle of the view, along the camera’s own axes, see throwProp.ts */
const gameHoldPoint = (camera: PerspectiveCamera): Vec3 => {
  camera.updateMatrixWorld()
  const look = camera.getWorldDirection(new Vector3)
  const up = new Vector3
  up.setFromMatrixColumn(camera.matrixWorld, 1)
  const tilt = radians(15)
  return camera.position.clone().addScaledVector(look, Math.cos(tilt) * 0.55).addScaledVector(up, -Math.sin(tilt) * 0.55).toArray()
}
test('a throw leaves from where the game’s camera holds an orb, however the camera rolls', () => {
  for (const roll of [-30, -5, 0, 12, 40]) {
    const shot = {
      position: [1, 1.6, 2] as Vec3,
      target: [3, 1.2, -1] as Vec3,
      fov: 50,
      roll,
    }
    const {pitch, yaw} = shotAngles(shot)
    const camera = new PerspectiveCamera(shot.fov)
    camera.position.set(...shot.position)
    // as slopGallery.pose turns it
    camera.quaternion.setFromEuler(new Euler(radians(pitch), radians(yaw), radians(roll), 'YXZ'))
    const expected = gameHoldPoint(camera)
    const actual = holdPoint(shot)
    for (const axis of [0, 1, 2]) {
      expect(actual[axis]).toBeCloseTo(expected[axis], 9)
    }
  }
})
