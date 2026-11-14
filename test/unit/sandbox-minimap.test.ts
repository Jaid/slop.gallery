import {afterEach, expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import SandboxMinimap from '../../src/components/SandboxMinimap/index.tsx'
import {cameraPose} from '../../src/lib/gallery.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

const pose = {
  position: cameraPose.position,
  direction: cameraPose.direction,
}
afterEach(() => Object.assign(cameraPose, pose))
test('the Sandbox’s map frames the Cell’s floor plan with the player on it, the room alone while a door shuts its north wall', () => {
  cameraPose.position = [1, 1.6, -2]
  cameraPose.direction = [1, 0, 0]
  const html = renderToStaticMarkup(createElement(SandboxMinimap, {lower: false}))
  const cell = sandbox.room('cell')
  const [width, depth] = cell.size
  const [x, z, frameWidth, frameDepth] = cell.map!.frame
  expect([x, x + frameWidth, z, z + frameDepth]).toEqual([-width / 2, width / 2, -depth / 2, depth / 2])
  expect(html).toContain(`viewBox="${x - 1} ${z - 1} ${frameWidth + 2} ${frameDepth + 2}"`)
  expect(html).toContain('data-room="cell"')
  expect(html).toContain('translate(1 -2) rotate(90)')
})
test('the Sandbox has a single floor, so its map stays empty for the lower one', () => {
  expect(renderToStaticMarkup(createElement(SandboxMinimap, {lower: true}))).toBe('')
})
test('the pause menu shows the Sandbox’s map of its upper floor wherever the player stands', () => {
  const cell = sandbox.room('cell')
  for (const position of [cell.spawn.position, [1, 1.6, -2], [0, 0, 0]] as const) {
    expect(sandbox.isLowerFloor(cell, [...position])).toBe(false)
  }
})
