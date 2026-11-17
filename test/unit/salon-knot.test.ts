import {expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {common, ethereal, knots, prime, rare} from 'knot-materials'
import KnotResources from 'knot-materials/KnotResources.ts'
import {knotSign} from 'knot-materials/signs.ts'

import PedestalGeometry, {pedestalHeight} from '../../src/lib/gallery/PedestalGeometry.ts'
import {salonBench, salonPedestal} from '../../src/lib/gallery/salon.ts'
import {knotShowcaseHoverGap} from '../../src/lib/gallery/showcasedKnots.ts'
import KnotRotation, {knotRotationPeriod} from '../../src/lib/physics/KnotRotation.ts'
import {knotStandingHeight, standingKnotSink, standKnot} from '../../src/lib/physics/standingKnot.ts'
import salonKnot, {salonKnotHeight, salonKnotRarityChances, salonKnots, salonKnotSign} from '../../src/rooms/salon/knot.ts'

await RAPIER.init()
/** the integration parameters `<Physics>` of @react-three/rapier sets by default */
const fiberIntegration = {
  normalizedAllowedLinearError: 0.001,
  normalizedPredictionDistance: 0.002,
}
const seeds = Array.from({length: 4000}, (_, seed) => seed)
test('the seed alone picks the Salon’s Knot from the retained pool, rolling rarity first', () => {
  expect(salonKnotRarityChances.reduce((sum, [, chance]) => sum + chance, 0)).toBeCloseTo(1, 9)
  expect(salonKnots.length).toBeGreaterThan(knots.length / 2)
  for (const knot of salonKnots) {
    expect((knot.displacement ?? 0) * salonKnotHeight / knotStandingHeight).toBeLessThanOrEqual(standingKnotSink)
  }
  expect(salonKnot(7).entry.id).toBe(salonKnot(7).entry.id)
  const rarities = new Map<number, number>
  const ids = new Set<string>
  for (const seed of seeds) {
    const {entry, height, position} = salonKnot(seed)
    expect(salonKnots).toContain(entry)
    expect(height).toBe(salonKnotHeight)
    expect(position).toEqual([salonPedestal[0], salonPedestal[1] + pedestalHeight, salonPedestal[2]])
    rarities.set(entry.rarity, (rarities.get(entry.rarity) ?? 0) + 1)
    ids.add(entry.id)
  }
  expect(rarities.keys().toArray().toSorted((a, b) => a - b)).toEqual([common, rare, prime, ethereal])
  for (const [rarity, chance] of salonKnotRarityChances) {
    expect(Math.abs(rarities.get(rarity)! / seeds.length - chance)).toBeLessThan(0.025)
  }
  expect(ids.size).toBeGreaterThan(salonKnots.length / 2)
})
test('the Salon Knot floats clear of its pedestal through a revolution, then drops when released', () => {
  // The largest shader displacement gives the most conservative collision clearance.
  const thickest = salonKnots.reduce((best, knot) => ((knot.displacement ?? 0) > (best.displacement ?? 0) ? knot : best))
  const resources = new KnotResources([thickest])
  const pedestal = new PedestalGeometry
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  const events = new RAPIER.EventQueue(true)
  Object.assign(world.integrationParameters, fiberIntegration)
  try {
    for (const [vertices, indices] of pedestal.collision) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices))
    }
    const {geometry, colliderVertices} = resources.items[0]
    const {scale, vertices} = standKnot(colliderVertices, salonKnotHeight)
    expect(1 / scale).toBeCloseTo(knotStandingHeight, 4)
    const skin = (thickest.displacement ?? 0) * scale
    const radius = geometry.boundingSphere!.radius * scale + skin
    const height = pedestalHeight + radius + knotShowcaseHoverGap
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, height, 0))
    const hull = world.createCollider(RAPIER.ColliderDesc.convexHull(vertices)!.setContactSkin(skin).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS), body)
    const rotation = new KnotRotation
    let contacts = 0
    for (let frame = 0; frame < knotRotationPeriod * 60; frame++) {
      rotation.advance(1 / 60)
      rotation.step(body)
      world.step(events)
      events.drainContactForceEvents(event => {
        if (event.collider1() === hull.handle || event.collider2() === hull.handle) {
          contacts++
        }
      })
    }
    expect(contacts).toBe(0)
    expect(rotation.isShowcased(body)).toBe(true)
    expect(body.translation().y).toBeCloseTo(height, 6)
    expect(rotation.release(body)).toBe(true)
    for (let frame = 0; frame < 120; frame++) {
      rotation.advance(1 / 60)
      rotation.step(body)
      world.step()
    }
    expect(body.isDynamic()).toBe(true)
    expect(rotation.isShowcased(body)).toBe(false)
    expect(body.translation().y).toBeLessThan(height - 0.1)
  } finally {
    events.free()
    world.free()
    pedestal.dispose()
    resources.dispose()
  }
})
test('the Knot nameplate stands east of the ottoman, facing it', () => {
  const {position: [x, y, z], rotation} = salonKnotSign
  expect(y).toBe(knotSign.elevation)
  expect(z).toBeGreaterThan(salonPedestal[2] + 1.5)
  expect(x).toBeGreaterThan(salonBench.position[0] + salonBench.width / 2 + 1)
  // Facing +z at no rotation, turned toward the ottoman’s middle.
  const facing = [Math.sin(rotation), Math.cos(rotation)]
  const toBench = [salonBench.position[0] - x, salonBench.position[2] - z]
  const length = Math.hypot(...toBench)
  expect(facing[0]).toBeCloseTo(toBench[0] / length, 9)
  expect(facing[1]).toBeCloseTo(toBench[1] / length, 9)
})
