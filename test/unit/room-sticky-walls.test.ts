import {expect, test} from 'bun:test'

import slopGallery from '../../src/worlds/gallery/index.ts'
import walls from './fixtures/gallery.ts'

const sticky = walls.filter(wall => wall.sticky !== false)
test('portraits stick to every wall but the stairways’, the passages’, the tunnel’s and the round ones of the Oculus’ apse and the Forge’s vestibule', () => {
  const others = walls.filter(wall => wall.sticky === false).map(wall => wall.id)
  expect(others.filter(id => !/^(?:corridor|exhibition|moonfall)-stairs_|^corridor-(?:landing_)?wall_\d+$|^bastion-(?:approach|climb_approach|climb_hairpin|climb_mouth|climb_run|curve|link|lodge-spur|mouth)_wall_\d+$|^bastion-cistern_(?:flat|round)$|^bastion-lodge-spur_end$|^exhibition-(?:east|west)(?:_(?:moonfall|oculus)(?:_bend)?)?$|^forge-vestibule$|^oculus-north(?:east|west)?$/u.test(id))).toEqual([])
  expect(sticky.some(wall => wall.curveRadius)).toBe(false)
  for (const room of ['antechamber', 'banquet', 'lobby', 'lodge', 'moonfall', 'oculus', 'salon', 'sienna', 'vesper']) {
    expect(sticky.some(wall => wall.room === room)).toBe(true)
  }
})
test('every portrait slot hangs in front of a sticky wall of its own room, within its width', () => {
  for (const slot of slopGallery.portraitSlots()) {
    const wall = sticky.find(value => value.id === slot.wallId)
    expect(wall?.room && slot.id.startsWith(`${wall.room}-`)).toBe(true)
    const u = (slot.position[0] - wall!.center[0]) * Math.cos(wall!.rotation) - (slot.position[2] - wall!.center[2]) * Math.sin(wall!.rotation)
    expect(Math.abs(u)).toBeLessThan(wall!.width / 2)
  }
})
