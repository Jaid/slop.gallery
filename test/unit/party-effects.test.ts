import type EffectSprites from '../../src/party_effects/lib/EffectSprites.ts'
import type {PartySite} from '../../src/party_effects/lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import {describe, expect, test} from 'bun:test'

import {galleryEvents, spawnPartyEffect} from '../../src/lib/gallery.ts'
import Fusion from '../../src/lib/gallery/fusion/Fusion.ts'
import FusionRecipe, {itemIngredient, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import {portalFrame, portalRadius} from '../../src/lib/gallery/fusion/portalFrame.ts'
import {fusionTiming} from '../../src/lib/gallery/fusion/timing.ts'
import spawnThroughTool from '../../src/lib/webmcp/spawnPartyEffect.ts'
import {halloweenOrb, horrorOrb, paintOrb, promptOrbs, spookOrb, transparentOrb} from '../../src/orbs/index.ts'
import PartyEffect from '../../src/party_effects/base/PartyEffect.ts'
import {batOffset, flyingBats} from '../../src/party_effects/bats/flights.ts'
import {airDrag, bloodBeats, bloodDrops, bloodFading, bloodFlight, gravity as bloodGravity, bloodLanding, bloodPool, bloodPour, bloodPouring, pourFall, pourVolume, splatLift} from '../../src/party_effects/blood/flights.ts'
import {escapingGhosts, ghostOffset} from '../../src/party_effects/ghosts/flights.ts'
import {partyEffects} from '../../src/party_effects/index.ts'
import {endParty, startParty, useParties} from '../../src/party_effects/lib/parties.ts'
import {offsetPosition, partySite} from '../../src/party_effects/lib/partySite.ts'
import {brushStrokes, strokeDrying, strokePoint} from '../../src/party_effects/strokes/flights.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const {bats: batsEffect, blood: bloodEffect, ghosts: ghostsEffect, strokes: strokesEffect} = partyEffects
const effects = Object.values<PartyEffect>(partyEffects)
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
describe('party effects', () => {
  test('the Spook Orb contributes its ghosts, which the recipe hands the portal once', () => {
    expect(spookOrb.ingredient(3).contributions).toContainEqual({
      kind: 'effect',
      effect: 'ghosts',
    })
    expect(transparentOrb.ingredient(3).contributions.some(contribution => contribution.kind === 'effect')).toBe(false)
    const recipe = new FusionRecipe([hung, itemIngredient(spookOrb.title, spookOrb.ingredient(3)), itemIngredient('Second Spook Orb', spookOrb.ingredient(4))])
    expect(recipe.effects).toEqual(['ghosts'])
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
            effect: 'ghosts',
          },
        ],
      }),
    ])
    expect(recipe.unchanged).toBe(true)
    expect(recipe.effects).toEqual(['ghosts'])
  })
  test('the ghosts keep the portal open until the last of them has faded away, longer than its own afterglow', () => {
    for (const {delay, life} of escapingGhosts) {
      expect(delay + life).toBeLessThanOrEqual(ghostsEffect.duration)
    }
    expect(ghostsEffect.duration).toBeGreaterThan(fusionTiming.afterglow)
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
    expect(fusion.afterglow).toBe(ghostsEffect.duration)
    fusion.abort()
  })
  test('the ghosts only escape once they are told that they burst out', () => {
    const show = ghostsEffect.stage(frame)
    const mesh = show.root
    expect(show.effect).toBe(ghostsEffect)
    expect(mesh.count).toBe(escapingGhosts.length)
    expect(mesh.position.toArray()).toEqual(frame.center)
    expect(mesh.uniforms.clock.value).toBeLessThan(0)
    show.update(-1)
    expect(mesh.uniforms.clock.value).toBeLessThan(0)
    show.update(-0.1)
    expect(mesh.uniforms.clock.value).toBeLessThan(0)
    show.update(1.5)
    expect(mesh.uniforms.clock.value).toBeCloseTo(1.5, 9)
    expect(show.over(ghostsEffect.duration)).toBe(false)
    expect(show.over(ghostsEffect.duration + 0.01)).toBe(true)
    show.dispose()
  })
  test('every themed orb names a party effect of its own, which it contributes to its fusion, and every party effect goes by its id', () => {
    expect(halloweenOrb.effect).toBe('bats')
    expect(horrorOrb.effect).toBe('blood')
    expect(spookOrb.effect).toBe('ghosts')
    expect(paintOrb.effect).toBe('strokes')
    expect(transparentOrb.effect).toBeUndefined()
    for (const orb of promptOrbs) {
      const contributed = orb.ingredient(3).contributions.filter(contribution => contribution.kind === 'effect')
      expect(contributed).toEqual([{
        kind: 'effect',
        effect: orb.effect,
      }])
    }
    for (const [id, effect] of Object.entries<PartyEffect>(partyEffects)) {
      expect(effect.id).toBe(id)
      expect(effect.title).toBeTruthy()
    }
    // None is left without an orb to bring it.
    expect(promptOrbs.map<string>(orb => orb.effect).toSorted()).toEqual(Object.keys(partyEffects).toSorted())
  })
  test('every effect’s sprites stand at their site’s center, know its floor and the way it faces and show nothing until they burst out, wherever the site is', () => {
    const sites: Array<PartySite> = [frame, partySite({
      position: [4, 2.5, -7],
      rotation: Math.PI / 2,
    }, -1), partySite({
      position: [0, 9, 0],
      floor: 3,
    }, 0)]
    for (const effect of effects) {
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
      expect(fusion.afterglow).toBe(effect.duration)
      fusion.abort()
      for (const site of sites) {
        const show = effect.stage(site)
        const sprites: EffectSprites = show.root
        expect(show.site).toBe(site)
        expect(sprites.count).toBeGreaterThan(0)
        expect(sprites.frustumCulled).toBe(false)
        expect(sprites.position.toArray()).toEqual(site.center)
        expect(sprites.uniforms.floor.value).toBeCloseTo(site.floor - site.center[1], 9)
        expect(sprites.uniforms.normal.value.toArray()).toEqual(site.normal)
        expect(sprites.uniforms.tangent.value.toArray()).toEqual(site.tangent)
        show.update(-1)
        expect(sprites.uniforms.clock.value).toBe(-1)
        show.update(0.25)
        expect(sprites.uniforms.clock.value).toBeCloseTo(0.25, 9)
        show.dispose()
      }
    }
  })
  test('a placement faces the way its rotation turns it around y, like a work on a wall and the portal in front of it, over the floor it names or the one it is given', () => {
    const facing = partySite({position: [1, 2, 3]}, 0.5)
    expect(facing.center).toEqual([1, 2, 3])
    expect(facing.floor).toBe(0.5)
    for (const [axis, value] of [0, 0, 1].entries()) {
      expect(facing.normal[axis]).toBeCloseTo(value, 12)
      expect(facing.tangent[axis]).toBeCloseTo([1, 0, 0][axis], 12)
    }
    const turned = partySite({
      position: [1, 2, 3],
      rotation: Math.PI / 2,
      floor: -2,
    }, 0.5)
    expect(turned.floor).toBe(-2)
    for (const [axis, value] of [1, 0, 0].entries()) {
      expect(turned.normal[axis]).toBeCloseTo(value, 12)
      expect(turned.tangent[axis]).toBeCloseTo([0, 0, -1][axis], 12)
    }
    for (const rotation of [0, 0.7, -2.1, Math.PI]) {
      const portal = portalFrame({
        ...work,
        rotation,
      }, {
        floor: 0,
        room: 4,
        sides: [3, 3],
      })
      const site = partySite({
        position: portal.center,
        rotation,
      }, portal.floor)
      expect(site.normal).toEqual(portal.normal)
      expect(site.tangent).toEqual(portal.tangent)
      expect(offsetPosition(site, [0.3, -0.2, 1.1])).toEqual(offsetPosition(portal, [0.3, -0.2, 1.1]))
    }
  })
  test('a show sounds once as it bursts out, where there is an output, and not at all if it only notices long after', () => {
    const sounded: Array<PartySite> = []
    class LoudEffect extends PartyEffect {
      readonly duration = 1
      readonly id = 'loud'
      readonly title = 'Loud'

      createSprites() {
        return ghostsEffect.createSprites()
      }

      extent() {
        return []
      }

      sound(_audio: AudioOutput, site: PartySite) {
        sounded.push(site)
      }
    }
    const effect = new LoudEffect
    const audio = {} as AudioOutput
    const punctual = effect.stage(frame)
    punctual.update(-1, audio)
    expect(sounded).toEqual([])
    punctual.update(0.02, audio)
    punctual.update(0.04, audio)
    expect(sounded).toEqual([frame])
    const silent = effect.stage(frame)
    silent.update(0.02)
    silent.update(0.04, audio)
    expect(sounded).toHaveLength(1)
    const late = effect.stage(frame)
    late.update(0.5, audio)
    late.update(0.52, audio)
    expect(sounded).toHaveLength(1)
    for (const show of [punctual, silent, late]) {
      show.dispose()
    }
  })
  test('a party effect plays anywhere on its own, over the floor the world has there, until it is ended', () => {
    const position: [number, number, number] = [0, 1.8, 2]
    const party = startParty('blood', {
      position,
      rotation: Math.PI,
    }, {delay: 0.5})
    expect(useParties.getState().parties).toEqual([party])
    expect(party.show.effect).toBe(bloodEffect)
    expect(party.show.site.center).toEqual(position)
    expect(party.show.site.floor).toBe(slopGallery.floorHeight(position))
    expect(party.show.site.normal[2]).toBeCloseTo(-1, 12)
    expect(party.startsAt).toBeGreaterThan(performance.now() + 400)
    const second = startParty('bats', {
      position,
      floor: -3,
    })
    expect(second.id).not.toBe(party.id)
    expect(second.show.site.floor).toBe(-3)
    expect(second.startsAt).toBeLessThanOrEqual(performance.now())
    endParty(party)
    expect(useParties.getState().parties).toEqual([second])
    endParty(second)
    endParty(second)
    expect(useParties.getState().parties).toEqual([])
    for (const {show} of [party, second]) {
      show.dispose()
    }
  })
  test('the gallery’s spawnPartyEffect asks for a party effect with where and how to play it', () => {
    const requests: Array<unknown> = []
    const listen = (event: Event) => {
      requests.push((event as CustomEvent<unknown>).detail)
    }
    galleryEvents.addEventListener('party-effect', listen)
    try {
      spawnPartyEffect('ghosts', {
        position: [1, 2, 3],
        rotation: 0.4,
      }, {delay: 2})
      spawnPartyEffect('bats', {position: [0, 0, 0]})
    } finally {
      galleryEvents.removeEventListener('party-effect', listen)
    }
    expect(requests).toEqual([{
      effect: 'ghosts',
      placement: {
        position: [1, 2, 3],
        rotation: 0.4,
      },
      options: {delay: 2},
    }, {
      effect: 'bats',
      placement: {position: [0, 0, 0]},
      options: undefined,
    }])
    // Nothing plays them without a scene.
    expect(useParties.getState().parties).toEqual([])
  })
  test('the spawn_party_effect tool’s spawner takes any party effect’s id and tells what it spawned, and names the effects for an id none has', () => {
    const spawn = spawnThroughTool({
      effect: 'strokes',
      position: [0, 1.8, 2],
      rotation: 0.5,
    })
    expect(spawn).toEqual({
      effect: 'strokes',
      position: [0, 1.8, 2],
      rotation: 0.5,
      floor: slopGallery.floorHeight([0, 1.8, 2]),
      duration: strokesEffect.duration,
    })
    const [party] = useParties.getState().parties
    expect(party.show.effect).toBe(strokesEffect)
    endParty(party)
    party.show.dispose()
    expect(() => spawnThroughTool({
      effect: 'confetti',
      position: [0, 0, 0],
    })).toThrow(/bats, blood, ghosts, strokes/)
    expect(() => spawnThroughTool({
      effect: 'toString',
      position: [0, 0, 0],
    })).toThrow(/no party effect/)
    expect(useParties.getState().parties).toEqual([])
  })
  test('every effect keeps the portal open until the last of it is gone, and all of them longer than its own afterglow', () => {
    for (const effect of effects) {
      expect(effect.duration).toBeGreaterThan(fusionTiming.afterglow)
    }
    expect(batsEffect.duration).toBe(Math.max(...flyingBats.map(({delay, life}) => delay + life)))
    expect(strokesEffect.duration).toBe(strokeDrying.start + strokeDrying.stagger + strokeDrying.seconds)
    expect(bloodEffect.duration).toBeCloseTo(Math.max(bloodFading.start + bloodFading.stagger + bloodFading.duration, bloodPool.draining.start + bloodPool.draining.seconds), 9)
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
    expect(draining.start + draining.seconds).toBeLessThanOrEqual(bloodEffect.duration)
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
    for (const effect of effects) {
      const extent = effect.extent(floor)
      expect(extent.length).toBeGreaterThan(20)
      expect(extent.flat().every(Number.isFinite)).toBe(true)
      expect(Math.min(...extent.map(([, up]) => up))).toBeGreaterThanOrEqual(floor)
      // Ever less of it is still to come, within where it reaches over its whole show, and nothing once it is over.
      const whole = boxOf(extent)
      const halfway = effect.extent(floor, effect.duration / 2)
      expect(halfway.length).toBeGreaterThan(0)
      expect(halfway.every(point => holds(whole, point))).toBe(true)
      expect(effect.extent(floor, effect.duration + 0.01)).toEqual([])
    }
    const at = (effect: PartyEffect, points: Array<readonly [number, number, number]>) => {
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
