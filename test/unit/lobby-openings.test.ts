import {expect, test} from 'bun:test'

import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import walls from '../../src/worlds/gallery/walls.ts'

const opening = (wallId: string, name: string) => {
  const wall = walls.find(candidate => candidate.id === wallId)!
  const hole = wall.holes!.find(candidate => candidate.name === name)!
  return {
    wall,
    hole,
    center: wallPosition(wall, hole.u, 0, 0),
  }
}
test('the Lobby’s three openings have equal clearance from its south corners and match their adjoining walls', () => {
  const south = opening('lobby-south', 'antechamber')
  const clearance = south.wall.width / 2 - Math.abs(south.hole.u) - south.hole.width / 2
  expect(clearance).toBeGreaterThan(0)
  for (const [side, room, adjoiningWall] of [['west', 'vesper', 'vesper-east'], ['east', 'banquet', 'banquet-west']] as const) {
    const lobby = opening(`lobby-${side}`, room)
    const adjoining = opening(adjoiningWall, 'lobby')
    expect(south.center[2] - lobby.center[2] - lobby.hole.width / 2).toBeCloseTo(clearance)
    for (const [index, coordinate] of lobby.center.entries()) {
      expect(adjoining.center[index]).toBeCloseTo(coordinate)
    }
    expect(adjoining.hole.width).toBe(lobby.hole.width)
    expect(adjoining.hole.height).toBe(lobby.hole.height)
    expect(adjoining.hole.profile).toBe(lobby.hole.profile)
  }
  const antechamber = opening('antechamber-north', 'lobby')
  for (const [index, coordinate] of south.center.entries()) {
    expect(antechamber.center[index]).toBeCloseTo(coordinate)
  }
  expect(antechamber.hole.width).toBe(south.hole.width)
})
