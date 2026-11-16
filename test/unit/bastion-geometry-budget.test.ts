import {expect, test} from 'bun:test'

import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {bastionApproach, bastionTransition} from '../../src/lib/gallery/bastion.ts'
import {bastionNetwork, climbMouthHollow} from '../../src/lib/gallery/bastionNetwork.ts'
import Passage from '../../src/lib/gallery/passages/Passage.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import VaultGeometry from '../../src/lib/gallery/passages/VaultGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import walls from './fixtures/gallery.ts'

test('Bastion passage meshes retain their reduced triangle budget', () => {
  let total = 0
  for (const passage of bastionNetwork) {
    const geometry = passage instanceof Passage ? new VaultGeometry(passage, passage === bastionApproach ? bastionTransition.length : 0) : new RouteVaultGeometry(passage)
    try {
      const parts = [geometry.shell, geometry.ribs, ...geometry instanceof RouteVaultGeometry ? [geometry.paving] : []]
      for (const part of parts) {
        total += triangleCount(part)
        // The timber transition leaves the stone approach with no ribs.
        if (!part.hasAttribute('position')) {
          expect(part).toBe(geometry.ribs)
          expect(passage).toBe(bastionApproach)
          continue
        }
        for (const name of ['position', 'normal']) {
          const attribute = part.getAttribute(name)
          expect([...attribute.array].every(Number.isFinite), `${passage.name} ${name}`).toBe(true)
        }
      }
    } finally {
      geometry.dispose()
    }
  }
  // Before #225 these sweeps alone took 189 038 triangles. Includes both sides of the shells, caps, ribs and slabs, not just the view-facing triangles.
  expect(total).toBeGreaterThan(0)
  expect(total).toBeLessThan(75_000)
})
test('Bastion walls and profiled skirting no longer multiply polygon fans by bend cuts', () => {
  let total = 0
  let trims = 0
  for (const wall of walls) {
    if (wall.room !== 'bastion') {
      continue
    }
    const geometry = createArchitectureGeometry(wall)
    try {
      total += [geometry.surface, ...geometry.trim, ...geometry.cornice, ...geometry.glazing].reduce((sum, part) => sum + triangleCount(part), 0)
      trims += geometry.trim.reduce((sum, part) => sum + triangleCount(part), 0)
      if (wall.id === 'bastion-cistern_round') {
        // Formerly 29 694 for the skirting alone; keep the entire curved wall below that by an order of magnitude.
        expect(geometry.trim.reduce((sum, part) => sum + triangleCount(part), 0)).toBeLessThan(3000)
      }
    } finally {
      geometry.dispose()
    }
  }
  expect(total).toBeLessThan(70_000)
  expect(trims).toBeLessThan(36_000)
})
test('the golf landing uses a sparse shared seam grid, including its solid return sill', () => {
  const geometry = climbMouthHollow.geometry()
  try {
    // Previously 10 854 before the return sill even existed.
    expect(triangleCount(geometry)).toBeLessThan(3000)
  } finally {
    geometry.dispose()
  }
})
