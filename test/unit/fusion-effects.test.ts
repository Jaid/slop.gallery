import type EffectSprites from '../../src/lib/gallery/fusion/effects/base/EffectSprites.ts'
import type EscapingGhosts from '../../src/lib/gallery/fusion/effects/ghosts/EscapingGhosts.ts'

import {describe, expect, test} from 'bun:test'

import {batOffset, flyingBats} from '../../src/lib/gallery/fusion/effects/bats/flights.ts'
import {airDrag, bloodBeats, bloodDrops, bloodFading, bloodFlight, gravity as bloodGravity, bloodLanding, bloodPool, bloodPour, bloodPouring, pourFall, pourVolume, splatLift} from '../../src/lib/gallery/fusion/effects/blood/flights.ts'
import {escapingGhosts, ghostOffset} from '../../src/lib/gallery/fusion/effects/ghosts/flights.ts'
import {batsEffect, bloodEffect, fusionEffects, ghostsEffect, strokesEffect} from '../../src/lib/gallery/fusion/effects/index.ts'
import {brushStrokes, strokeDrying, strokePoint} from '../../src/lib/gallery/fusion/effects/strokes/flights.ts'
import Fusion from '../../src/lib/gallery/fusion/Fusion.ts'
import FusionRecipe, {itemIngredient, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import {portalFrame, portalRadius} from '../../src/lib/gallery/fusion/portalFrame.ts'
import {fusionTiming} from '../../src/lib/gallery/fusion/timing.ts'
import {halloweenOrb, horrorOrb, paintOrb, promptOrbs, spookOrb, transparentOrb} from '../../src/lib/gallery/orbs/index.ts'

const hung = portraitIngredient({
  title: 'The hung portrait',
  source: '/hung.jxl',
})
const work = {
  id: 'work',
  position: [0, 1.7, 0] as [number, number, number],
  rotation: 0,
  width: 1,
  height: 1,
}
const frame = portalFrame(work, {
  floor: 0,
  room: 4,
  sides: [3, 3],
})
/** the box round the points, as the lowest and highest value of each axis */
const boxOf = (points: ReadonlyArray<readonly [number, number, number]>) => [0, 1, 2].map(axis => [Math.min(...points.map(point => point[axis])), Math.max(...points.map(point => point[axis]))])
const holds = (box: Array<Array<number>>, point: readonly [number, number, number]) => point.every((value, axis) => value >= box[axis][0] - 1e-9 && value <= box[axis][1] + 1e-9)
describe('fusion effects', () => {
  test('the Spook Orb contributes its ghosts, which the recipe hands the portal once', () => {
    expect(spookOrb.ingredient(3).contributions).toContainEqual({
      kind: 'effect',
      effect: ghostsEffect,
    })
    expect(transparentOrb.ingredient(3).contributions.some(contribution => contribution.kind === 'effect')).toBe(false)
    const recipe = new FusionRecipe([hung, itemIngredient(spookOrb.title, spookOrb.ingredient(3)), itemIngredient('Second Spook Orb', spookOrb.ingredient(4))])
    expect(recipe.effects).toEqual([ghostsEffect])
    const clear = new FusionRecipe([hung, itemIngredient(transparentOrb.title, transparentOrb.ingredient(3))])
    expect(clear.effects).toEqual([])
  })
  test('an effect gives an image model nothing to do', () => {
    const recipe = new FusionRecipe([
      hung,
      itemIngredient('Ghost Jar', {
        contributions: [
          {
            kind: 'effect',
            effect: ghostsEffect,
          },
        ],
      }),
    ])
    expect(recipe.unchanged).toBe(true)
    expect(recipe.effects).toEqual([ghostsEffect])
  })
  test('the ghosts keep the portal open until the last of them has faded away, longer than its own afterglow', () => {
    for (const {delay, life} of escapingGhosts) {
      expect(delay + life).toBeLessThanOrEqual(ghostsEffect.afterglow)
    }
    expect(ghostsEffect.afterglow).toBeGreaterThan(fusionTiming.afterglow)
    const fusion = new Fusion({
      work,
      partner: {
        kind: 'item',
        id: 'prop-orb-spook',
        consumed: true,
      },
      images: ['/hung.jxl'],
      latches: ['charge', 'glass'] as const,
      effects: [ghostsEffect],
    }, {frame})
    expect(fusion.afterglow).toBe(ghostsEffect.afterglow)
    fusion.abort()
  })
  test('the ghosts only escape once the result flipped out, and stay silent without sound', () => {
    const fusion = new Fusion({
      work,
      partner: {
        kind: 'item',
        id: 'prop-orb-spook',
        consumed: true,
      },
      images: ['/hung.jxl'],
      latches: ['charge', 'glass'] as const,
      effects: [ghostsEffect],
    }, {frame})
    const show = ghostsEffect.show(fusion)
    const mesh = show.root.children[0] as EscapingGhosts
    expect(mesh.count).toBe(escapingGhosts.length)
    expect(mesh.position.toArray()).toEqual(frame.center)
    show.update(5)
    expect(mesh.uniforms.clock.value).toBeLessThan(0)
    fusion.emergedAt = 6
    show.update(5.9)
    expect(mesh.uniforms.clock.value).toBeLessThan(0)
    show.update(7.5)
    expect(mesh.uniforms.clock.value).toBeCloseTo(1.5, 9)
    show.dispose()
    fusion.abort()
  })
  test('every themed orb contributes an effect of its own, which an id names that starts with the orb’s', () => {
    expect(halloweenOrb.effect).toBe(batsEffect)
    expect(horrorOrb.effect).toBe(bloodEffect)
    expect(spookOrb.effect).toBe(ghostsEffect)
    expect(paintOrb.effect).toBe(strokesEffect)
    for (const orb of promptOrbs) {
      const effects = orb.ingredient(3).contributions.filter(contribution => contribution.kind === 'effect')
      expect(effects).toEqual([{
        kind: 'effect',
        effect: orb.effect,
      }])
    }
    const ids = fusionEffects.map(effect => effect.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
    for (const id of ids) {
      expect(promptOrbs.some(orb => id.startsWith(`${orb.id}-`))).toBe(true)
    }
  })
  test('every effect’s sprites stand at the portal’s middle, know the floor and show nothing until the result flipped out', () => {
    for (const effect of fusionEffects) {
      const fusion = new Fusion({
        work,
        partner: {
          kind: 'item',
          id: 'prop-orb-halloween',
          consumed: true,
        },
        images: ['/hung.jxl'],
        latches: ['charge', 'glass'] as const,
        effects: [effect],
      }, {frame})
      expect(fusion.afterglow).toBe(effect.afterglow)
      const show = effect.show(fusion)
      const sprites = show.root.children[0] as EffectSprites
      expect(sprites.count).toBeGreaterThan(0)
      expect(sprites.frustumCulled).toBe(false)
      expect(sprites.position.toArray()).toEqual(frame.center)
      expect(sprites.uniforms.floor.value).toBeCloseTo(frame.floor - frame.center[1], 9)
      expect(sprites.uniforms.normal.value.toArray()).toEqual(frame.normal)
      expect(sprites.uniforms.tangent.value.toArray()).toEqual(frame.tangent)
      show.update(5)
      expect(sprites.uniforms.clock.value).toBe(-1)
      fusion.emergedAt = 6
      show.update(6.25)
      expect(sprites.uniforms.clock.value).toBeCloseTo(0.25, 9)
      show.dispose()
      fusion.abort()
    }
  })
  test('every effect keeps the portal open until the last of it is gone, and all of them longer than its own afterglow', () => {
    for (const effect of fusionEffects) {
      expect(effect.afterglow).toBeGreaterThan(fusionTiming.afterglow)
    }
    expect(batsEffect.afterglow).toBe(Math.max(...flyingBats.map(({delay, life}) => delay + life)))
    expect(strokesEffect.afterglow).toBe(strokeDrying.start + strokeDrying.stagger + strokeDrying.seconds)
    expect(bloodEffect.afterglow).toBeCloseTo(Math.max(bloodFading.start + bloodFading.stagger + bloodFading.duration, bloodPool.draining.start + bloodPool.draining.seconds), 9)
  })
  test('the bats burst out of the portal’s middle and fly out into the room', () => {
    for (const bat of flyingBats) {
      for (const [axis, value] of batOffset(bat, 0).entries()) {
        expect(value).toBeCloseTo([0, 0, 0.05][axis], 9)
      }
      const [, , out] = batOffset(bat, bat.life)
      expect(out).toBeGreaterThan(0.3)
    }
  })
  test('the air slows a drop down the more the finer it is, and it lands where its fall meets the floor, before the stains fade', () => {
    expect(airDrag(0.0005)).toBeGreaterThan(airDrag(0.02))
    const thrown = bloodDrops.filter(({kind}) => kind === 'drop' || kind === 'mist')
    for (const floor of [-1.55, frame.floor - frame.center[1], -2.05]) {
      for (const drop of thrown) {
        const {landing, speed} = bloodLanding(drop, floor)
        const drag = airDrag(drop.size)
        const terminal = bloodGravity / drag
        const decay = Math.exp(-drag * landing)
        const height = drop.start[1] + (drop.velocity[1] + terminal) * (1 - decay) / drag - terminal * landing
        expect(height).toBeCloseTo(floor + splatLift, 3)
        expect(speed).toBeGreaterThan(0)
        expect(speed).toBeLessThanOrEqual(Math.hypot(...drop.velocity) + terminal + 1e-9)
        expect(drop.delay + landing).toBeLessThan(bloodFading.start)
      }
    }
  })
  test('the pool fills with all the blood the pour brings down before it is sucked back, which is done by the time the portal closes', () => {
    const {draining} = bloodPool
    expect(bloodDrops[0].kind).toBe('pool')
    expect(bloodDrops[1].kind).toBe('pour')
    expect(pourVolume(bloodPour.flowing[0])).toBe(0)
    expect(pourVolume(bloodPour.flowing[1])).toBe(1)
    for (const [earlier, later] of [[0.1, 0.3], [0.3, 0.6], [0.6, 0.85]]) {
      expect(pourVolume(later)).toBeGreaterThan(pourVolume(earlier))
    }
    expect(pourVolume(1.5)).toBe(1)
    for (const floor of [-1.55, frame.floor - frame.center[1], -2.05]) {
      const {from, spot, surges, to} = bloodPouring(floor)
      expect(from).toBeCloseTo(bloodPour.flowing[0] + pourFall(bloodPour.start[1] - floor - splatLift), 9)
      expect(to).toBeLessThan(draining.start)
      expect(surges.length).toBe(bloodBeats.filter(({at}) => at + bloodPour.flowing[0] < bloodPour.flowing[1]).length)
      expect(surges.length).toBeGreaterThan(1)
      expect(surges.every(({at}) => at >= from && at < to)).toBe(true)
      expect([spot[0], spot[2]]).toEqual([...bloodPool.center])
    }
    expect(pourFall(1.4)).toBeLessThan(Math.sqrt(2 * 1.4 / bloodGravity))
    expect(draining.start + draining.seconds).toBeLessThanOrEqual(bloodEffect.afterglow)
  })
  test('the brush strokes curve around the portal clear of its ball, are laid one after another, each before it dries away, and turn on and drift out into the room once laid', () => {
    for (const stroke of brushStrokes) {
      for (const share of [0, 0.5, 1]) {
        const [along, up] = strokePoint(stroke, share, 0)
        expect(Math.hypot(along, up) - stroke.width / 2).toBeGreaterThan(portalRadius)
      }
      expect(stroke.delay + stroke.duration).toBeLessThan(strokeDrying.start)
      expect(stroke.paint.every(paint => Number.isInteger(paint) && paint >= 0 && paint < 5)).toBe(true)
    }
    const delays = brushStrokes.map(({delay}) => delay)
    expect(delays).toEqual(delays.toSorted((a, b) => a - b))
    const [stroke] = brushStrokes
    const [along, up, out] = strokePoint(stroke, 0, 0)
    const [laterAlong, laterUp, laterOut] = strokePoint(stroke, 0, 1)
    expect(Math.atan2(laterUp, laterAlong)).not.toBeCloseTo(Math.atan2(up, along), 2)
    expect(laterOut).toBeGreaterThan(out)
  })
  test('every effect tells where it reaches over its whole show, holding everything it flies, lays or spills, never below the floor', () => {
    const floor = frame.floor - frame.center[1]
    for (const effect of fusionEffects) {
      const extent = effect.extent(floor)
      expect(extent.length).toBeGreaterThan(20)
      expect(extent.flat().every(Number.isFinite)).toBe(true)
      expect(Math.min(...extent.map(([, up]) => up))).toBeGreaterThanOrEqual(floor)
      // Ever less of it is still to come, within where it reaches over its whole show, and nothing once it is over.
      const whole = boxOf(extent)
      const halfway = effect.extent(floor, effect.afterglow / 2)
      expect(halfway.length).toBeGreaterThan(0)
      expect(halfway.every(point => holds(whole, point))).toBe(true)
      expect(effect.extent(floor, effect.afterglow + 0.01)).toEqual([])
    }
    const at = (effect: typeof fusionEffects[number], points: Array<readonly [number, number, number]>) => {
      const box = boxOf(effect.extent(floor))
      expect(points.every(point => holds(box, point))).toBe(true)
    }
    at(batsEffect, flyingBats.flatMap(bat => [0.1, 0.4, 0.8].map(share => batOffset(bat, bat.life * share))))
    at(ghostsEffect, escapingGhosts.flatMap(ghost => [0.1, 0.4, 0.8].map(share => ghostOffset(ghost, ghost.life * share))))
    at(strokesEffect, brushStrokes.flatMap(stroke => [0.2, 0.7].flatMap(share => [0, 1, 2].map(seconds => strokePoint(stroke, share, seconds)))))
    // every stain where its drop strikes the floor, and the pool at its widest
    const splats = bloodDrops.filter(drop => drop.kind === 'drop').map(drop => bloodFlight(drop, bloodLanding(drop, floor).landing).offset)
    expect(Math.max(...splats.map(([, up]) => Math.abs(up - floor - splatLift)))).toBeLessThan(1e-3)
    at(bloodEffect, [...splats, [bloodPool.center[0] + bloodPool.radius, floor + splatLift, bloodPool.center[1]], [bloodPool.center[0], floor + splatLift, bloodPool.center[1] - bloodPool.radius]])
  })
})
