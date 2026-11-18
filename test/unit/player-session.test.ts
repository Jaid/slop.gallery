import type {PlayerPose} from '../../src/lib/gallery/types.ts'

import {describe, expect, test} from 'bun:test'

import {defaultEgoOptions} from 'ego-player/motor'

import {corridorStairs} from '../../src/lib/gallery/corridor.ts'
import lodge, {lodgeWindow} from '../../src/lib/gallery/lodge.ts'
import PlayerSession, {validatePlayerPose} from '../../src/lib/gallery/PlayerSession.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

describe('player session', () => {
  test('pitches that are not finite or look beyond straight up or down are rejected', () => {
    for (const pitch of [Number.NaN, Infinity, Math.PI]) {
      expect(validatePlayerPose({
        ...slopGallery.spawn,
        pitch,
      })).toBeNull()
    }
  })
  test('invalid player poses are rejected and restore the spawn', () => {
    const session = new PlayerSession(slopGallery)
    for (const player of [
      {
        position: [0, 0, -9],
        yaw: Number.NaN,
        pitch: 0,
      },
      {
        position: [0, Infinity, 0],
        yaw: 0,
        pitch: 0,
      },
      {
        position: [400, 0, 0],
        yaw: 0,
        pitch: 0,
      },
      {
        position: [-25, -4.9, -20],
        yaw: 0,
        pitch: 0,
      },
    ] satisfies Array<PlayerPose>) {
      expect(validatePlayerPose(player)).toBeNull()
      session.restore(player)
      expect(session.snapshot()).toEqual(slopGallery.spawn)
    }
  })
  test('room, tunnel and stair poses are kept without camera-height offsets or shared arrays', () => {
    const tread = corridorStairs.blocks[12]
    for (const position of [[0, 0.02, -9], [-25, lodge.floorY + 0.02, -35], [-33, lodge.floorY + 0.02, -20], [(lodgeWindow.roomX + lodgeWindow.tunnelX) / 2, lodgeWindow.bottom + 0.02, lodgeWindow.z], [tread.position[0], tread.top + 0.02, tread.position[2]]] as const) {
      const session = new PlayerSession(slopGallery)
      const pose = {
        position: [...position] as [number, number, number],
        yaw: 1.23,
        pitch: -0.108,
      }
      session.capture(pose)
      const snapshot = session.snapshot()
      expect(snapshot.position).toEqual(pose.position)
      expect(snapshot.yaw).toBeCloseTo(pose.yaw)
      expect(snapshot.pitch).toBeCloseTo(pose.pitch)
      pose.position[0] = 900
      snapshot.position[0] = 900
      expect(session.snapshot().position).toEqual([...position])
    }
  })
  test('movement stays out of React updates', () => {
    const session = new PlayerSession(slopGallery)
    const pose = {
      position: [-25, -4.98, -35] as [number, number, number],
      yaw: -0.7,
      pitch: 0,
    }
    let updates = 0
    const unsubscribe = useGallery.subscribe(() => updates++)
    session.capture(pose)
    expect(updates).toBe(0)
    unsubscribe()
    expect(session.snapshot().position).toEqual(pose.position)
  })
  test('equivalent yaw wraps and captures outside the world are ignored', () => {
    const session = new PlayerSession(slopGallery)
    session.capture({
      ...slopGallery.spawn,
      yaw: slopGallery.spawn.yaw + Math.PI * 2,
    })
    expect(session.snapshot().yaw).toBeCloseTo(slopGallery.spawn.yaw)
    session.capture({
      ...slopGallery.spawn,
      position: [900, 900, 900],
    })
    expect(session.snapshot().position).toEqual(slopGallery.spawn.position)
  })
  test('a flying player is where its eyes are, whose feet may hang out of the world', () => {
    // a camera bookmark near the floor, with nothing below that would hold the feet
    const bookmark = slopGallery.cameraBookmarks().find(candidate => !slopGallery.contains(slopGallery.cameraBookmarkFeet(candidate)))!
    const skimming: PlayerPose = {
      ...bookmark.aim,
      position: slopGallery.cameraBookmarkFeet(bookmark),
    }
    expect(skimming.position[1] + defaultEgoOptions.eyeHeight).toBeCloseTo(bookmark.position[1], 10)
    expect(validatePlayerPose(skimming)).toBeNull()
    expect(validatePlayerPose(skimming, slopGallery, true)?.position).toEqual(skimming.position)
    const session = new PlayerSession(slopGallery)
    session.restore(skimming, true)
    expect(session.snapshot().position).toEqual(skimming.position)
    session.capture({
      ...skimming,
      position: [900, 900, 900],
    }, true)
    expect(session.snapshot().position).toEqual(skimming.position)
    session.restore(skimming)
    expect(session.snapshot()).toEqual(slopGallery.spawn)
  })
})
