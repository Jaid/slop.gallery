import type EffectSprites from '../../src/lib/gallery/fusion/effects/base/EffectSprites.ts'
import type EscapingGhosts from '../../src/lib/gallery/fusion/effects/ghosts/EscapingGhosts.ts'

import {describe, expect, test} from 'bun:test'

import {batOffset, flyingBats} from '../../src/lib/gallery/fusion/effects/bats/flights.ts'
import {airDrag, bloodBeats, bloodDrops, bloodFading, gravity as bloodGravity, bloodLanding, bloodPool, splatLift} from '../../src/lib/gallery/fusion/effects/blood/flights.ts'
import {escapingGhosts} from '../../src/lib/gallery/fusion/effects/ghosts/flights.ts'
import {batsEffect, bloodEffect, fusionEffects, ghostsEffect} from '../../src/lib/gallery/fusion/effects/index.ts'
import Fusion from '../../src/lib/gallery/fusion/Fusion.ts'
import FusionRecipe, {itemIngredient, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import {portalFrame} from '../../src/lib/gallery/fusion/portalFrame.ts'
import {fusionTiming} from '../../src/lib/gallery/fusion/timing.ts'
import {halloweenOrb, horrorOrb, promptOrbs, spookOrb, transparentOrb} from '../../src/lib/gallery/orbs/index.ts'

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
    for (const orb of promptOrbs) {
      expect(orb.ingredient(3).contributions).toContainEqual({
        kind: 'effect',
        effect: orb.effect,
      })
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
    const thrown = bloodDrops.filter(({kind}) => kind !== 'pool')
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
  test('the pool fills with the blood of every beat before it is sucked back, which is done by the time the portal closes', () => {
    const {draining, filling} = bloodPool
    expect(bloodDrops[0].kind).toBe('pool')
    expect(Math.max(...bloodBeats.map(({at}) => at)) + filling[1]).toBeLessThan(draining.start)
    expect(draining.start + draining.seconds).toBeLessThanOrEqual(bloodEffect.afterglow)
  })
})
