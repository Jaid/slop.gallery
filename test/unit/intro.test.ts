import {expect, test} from 'bun:test'

import {defaultEgoOptions} from 'ego-player'

import IntroOrbit from '../../src/lib/camera/IntroOrbit.ts'
import {introDirection, readIntro} from '../../src/lib/gallery/intro.ts'
import {lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

const orbit = slopGallery.introOrbit
const samples = Array.from({length: 360}, (_, second) => orbit.pose(second / 6))
test('only a URL that places the camera nowhere else opens with the intro', () => {
  expect(readIntro('http://localhost/')).toBe(true)
  expect(readIntro('http://localhost/?development=true&audio=true&seed=1')).toBe(true)
  expect(readIntro('http://localhost/?room=moonfall')).toBe(false)
  expect(readIntro('http://localhost/?spawn=lobby-overview')).toBe(false)
  expect(readIntro('http://localhost/?test=true')).toBe(false)
})
test('only the gallery has an intro', () => {
  expect(slopGallery.introOrbit).toBeInstanceOf(IntroOrbit)
  expect(knottingham.introOrbit).toBeUndefined()
  expect(sandbox.introOrbit).toBeUndefined()
})
test('the intro turns once a minute, looking at the fountain, either way the seed flips', () => {
  const start = orbit.pose(0)
  const turned = orbit.pose(60)
  for (const [index, value] of start.position.entries()) {
    expect(turned.position[index]).toBeCloseTo(value, 9)
  }
  for (const {position, yaw, pitch} of samples) {
    // Along the view, the camera reaches the fountain’s axis.
    const distance = Math.hypot(position[0] - lobbyFountainSpot[0], position[2] - lobbyFountainSpot[2])
    expect(position[0] - Math.sin(yaw) * distance).toBeCloseTo(lobbyFountainSpot[0], 9)
    expect(position[2] - Math.cos(yaw) * distance).toBeCloseTo(lobbyFountainSpot[2], 9)
    expect(pitch).toBeLessThan(0)
  }
  expect(orbit.pose(15, -1).position).not.toEqual(orbit.pose(15, 1).position)
  const directions = new Set(Array.from({length: 64}, (_, seed) => introDirection(seed)))
  expect([...directions].toSorted((a, b) => a - b)).toEqual([-1, 1])
})
test('the player taking over the intro’s camera stands inside the Lobby, clear of the fountain and its benches, and falls two to two and a half meters', () => {
  for (const {position} of samples) {
    const feet = [position[0], position[1] - defaultEgoOptions.eyeHeight, position[2]] as [number, number, number]
    expect(slopGallery.contains(feet)).toBe(true)
    expect(slopGallery.roomAt(feet)?.id).toBe('lobby')
    const fall = feet[1] - slopGallery.floorHeight(feet)
    expect(position[1] - slopGallery.floorHeight(feet)).toBeCloseTo(4, 9)
    expect(fall).toBeGreaterThanOrEqual(2)
    expect(fall).toBeLessThanOrEqual(2.5)
    // Beyond the benches, 4 m out and 0.8 m deep, with the capsule’s radius to spare; within the Lobby’s walls just as well.
    expect(Math.hypot(feet[0] - lobbyFountainSpot[0], feet[2] - lobbyFountainSpot[2])).toBeGreaterThan(4.4 + defaultEgoOptions.radius)
    expect(Math.abs(feet[0])).toBeLessThan(8 - defaultEgoOptions.radius)
  }
})
