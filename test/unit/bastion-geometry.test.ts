import type RoutedPassage from '../../src/lib/gallery/passages/RoutedPassage.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import {MeshBVH} from 'three-mesh-bvh'
import {Vector3} from 'three/webgpu'

import {architectureGeometry, colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import {bastionMouth} from '../../src/lib/gallery/bastion.ts'
import {bastionNetwork, climbMouthHollow} from '../../src/lib/gallery/bastionNetwork.ts'
import CisternGeometry from '../../src/lib/gallery/cistern/CisternGeometry.ts'
import {climbHairpin} from '../../src/lib/gallery/climb.ts'
import Passage from '../../src/lib/gallery/passages/Passage.ts'
import {passagePendantMounts, routePendantMounts} from '../../src/lib/gallery/pendants/mounts.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import VaultGeometry from '../../src/lib/gallery/passages/VaultGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import walls from './fixtures/gallery.ts'

const built: Array<RouteVaultGeometry | VaultGeometry> = []
const routeVault = (passage: RoutedPassage, detail?: number) => {
  const geometry = new RouteVaultGeometry(passage, detail)
  built.push(geometry)
  return geometry
}
const vault = (passage: Passage, detail?: number) => {
  const geometry = new VaultGeometry(passage, 0, detail)
  built.push(geometry)
  return geometry
}
afterAll(() => {
  for (const geometry of built) {
    geometry.dispose()
  }
})
/** the triangles a passage draws at the canonical fidelity realtime graphics take: its vault, its ribs and, along a route, its paving */
const passageTriangles = new Map(bastionNetwork.map(passage => {
  if (passage instanceof Passage) {
    const geometry = vault(passage)
    return [passage.name, triangleCount(geometry.shell) + triangleCount(geometry.ribs)] as const
  }
  const geometry = routeVault(passage)
  return [passage.name, triangleCount(geometry.shell) + triangleCount(geometry.ribs) + triangleCount(geometry.paving)] as const
}))
describe('the Bastion’s triangle budget', () => {
  // Down from 190 070 before the overhaul: the vaults’ backs and turns are swept at the fidelity their buried chords earn, and the paving is only cut where its height bends across it. The caps leave headroom for layout changes, not for the old tessellation to creep back.
  test('its passages’ vaults, ribs and paving stay lean, each and all together', () => {
    const caps: Record<string, number> = {
      'bastion-mouth': 3400,
      'bastion-curve': 19_500,
      'bastion-approach': 1700,
      'bastion-climb_mouth': 6800,
      'bastion-climb_hairpin': 17_000,
      'bastion-climb_run': 4800,
      'bastion-climb_approach': 4400,
      'bastion-link': 27_000,
      'bastion-lodge-spur': 1900,
    }
    expect(passageTriangles.keys().toArray().toSorted()).toEqual(Object.keys(caps).toSorted())
    for (const [name, triangles] of passageTriangles) {
      expect(triangles, name).toBeLessThan(caps[name])
    }
    expect(passageTriangles.values().reduce((sum, triangles) => sum + triangles, 0)).toBeLessThan(85_000)
  })
  test('its walls, trims and cornices stay lean, down from 163 786', () => {
    const bastionWalls = walls.filter(wall => wall.room === 'bastion')
    expect(bastionWalls.length).toBeGreaterThan(50)
    let total = 0
    for (const wall of bastionWalls) {
      const geometry = architectureGeometry(wall)
      total += triangleCount(geometry.surface) + geometry.trim.reduce((sum, part) => sum + triangleCount(part), 0) + geometry.cornice.reduce((sum, part) => sum + triangleCount(part), 0)
    }
    expect(total).toBeLessThan(60_000)
  })
  test('the gate’s hollow and the cistern’s channel, floor and water stay lean', () => {
    const hollow = climbMouthHollow.geometry()
    const cistern = new CisternGeometry
    try {
      expect(triangleCount(hollow)).toBeLessThan(3200)
      expect(triangleCount(cistern.channel) + triangleCount(cistern.floor) + triangleCount(cistern.water) + triangleCount(cistern.falling)).toBeLessThan(13_000)
    } finally {
      hollow.dispose()
      cistern.dispose()
    }
  })
})
describe('the graphics modes’ one physics', () => {
  test('Cinematic draws a routed vault and its ribs more finely, but collides with the canonical sweep’s very triangles, and its paving never changes at all', () => {
    const realtime = routeVault(climbHairpin)
    const cinematic = routeVault(climbHairpin, 2)
    expect(cinematic.shellCollision).not.toBe(cinematic.shell)
    expect(triangleCount(cinematic.shell)).toBeGreaterThan(triangleCount(realtime.shell) * 1.5)
    expect(triangleCount(cinematic.ribs)).toBeGreaterThan(triangleCount(realtime.ribs) * 1.5)
    expect(colliderGeometry(cinematic.shellCollision)).toEqual(colliderGeometry(realtime.shell))
    expect(colliderGeometry(cinematic.ribsCollision)).toEqual(colliderGeometry(realtime.ribs))
    expect(colliderGeometry(cinematic.pavingCollision)).toEqual(colliderGeometry(realtime.pavingCollision))
    expect(colliderGeometry(cinematic.paving)).toEqual(colliderGeometry(realtime.paving))
    expect(realtime.shellCollision).toBe(realtime.shell)
    expect(realtime.ribsCollision).toBe(realtime.ribs)
  })
  test('Cinematic draws a straight passage’s vault more finely, but collides with the canonical one’s very triangles', () => {
    const realtime = vault(bastionMouth)
    const cinematic = vault(bastionMouth, 2)
    expect(cinematic.shellCollision).not.toBe(cinematic.shell)
    expect(triangleCount(cinematic.shell) + triangleCount(cinematic.ribs)).toBeGreaterThan((triangleCount(realtime.shell) + triangleCount(realtime.ribs)) * 1.5)
    expect(colliderGeometry(cinematic.shellCollision)).toEqual(colliderGeometry(realtime.shell))
    expect(colliderGeometry(cinematic.ribsCollision)).toEqual(colliderGeometry(realtime.ribs))
  })
  test('a curve detail that is no whole multiplier of the canonical fidelity is refused', () => {
    for (const detail of [0, -1, 1.5, Number.NaN]) {
      expect(() => new RouteVaultGeometry(climbHairpin, detail)).toThrow(RangeError)
      expect(() => new VaultGeometry(bastionMouth, 0, detail)).toThrow(RangeError)
    }
  })
  test('the canonical shell still hugs Cinematic’s: every vertex of either lies within a few centimeters of the other, the unseen back taking the loosest of it', () => {
    const realtime = routeVault(climbHairpin)
    const cinematic = routeVault(climbHairpin, 2)
    const point = new Vector3
    const farthest = (from: typeof realtime.shell, to: typeof realtime.shell) => {
      const bvh = new MeshBVH(to)
      const positions = from.getAttribute('position')
      let maximum = 0
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i)
        maximum = Math.max(maximum, bvh.closestPointToPoint(point)!.distance)
      }
      return maximum
    }
    expect(farthest(realtime.shell, cinematic.shell)).toBeLessThan(0.02)
    expect(farthest(cinematic.shell, realtime.shell)).toBeLessThan(0.05)
    expect(farthest(realtime.ribs, cinematic.ribs)).toBeLessThan(0.02)
    expect(farthest(cinematic.ribs, realtime.ribs)).toBeLessThan(0.05)
  })
})
describe('pendant canopies on the leaner vaults', () => {
  // A canopy’s rim has to lie on one plane within millimeters. Coarsening a crown past that leaves a passage with nowhere to hang its lanterns from, which only shows when its room mounts – the straight vaults keep their original chord count for exactly this.
  test('every stone passage still offers ceiling wide enough for its pendants, at both fidelities', () => {
    for (const passage of bastionNetwork) {
      for (const detail of [1, 2]) {
        if (passage instanceof Passage) {
          const geometry = vault(passage, detail)
          expect(passagePendantMounts(passage, [geometry.shell, geometry.ribs]).length, `${passage.name} at detail ${detail}`).toBeGreaterThan(0)
        } else {
          const geometry = routeVault(passage, detail)
          expect(routePendantMounts(passage, [geometry.shell, geometry.ribs], [passage.ribGap(passage.route.length / 2)]).length, `${passage.name} at detail ${detail}`).toBe(1)
        }
      }
    }
  })
})
