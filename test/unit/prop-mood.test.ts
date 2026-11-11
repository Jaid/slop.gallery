import type {MoodId} from '../../src/moods/index.ts'

import {describe, expect, test} from 'bun:test'

import {flavorSteering} from '../../src/lib/gallery/alchemy/flavor.ts'
import {hatchet, helmet, paintingSet, pumpkin} from '../../src/lib/gallery/curios/index.ts'
import {moods} from '../../src/moods/index.ts'
import MoodMixer, {moodFade} from '../../src/moods/lib/MoodMixer.ts'
import {propMood} from '../../src/moods/lib/propMood.ts'
import {halloweenOrb, horrorOrb, orbs, paintOrb, spookOrb} from '../../src/orbs/index.ts'

const magicItems = [
  [helmet, spookOrb],
  [hatchet, horrorOrb],
  [paintingSet, paintOrb],
  [pumpkin, halloweenOrb],
] as const
const props = new Map<string, {mood?: MoodId}>([
  ...magicItems.flatMap(([item]) => [[item.propId, {}], [`${item.propId}-2`, {}]] as const),
  ...orbs.map(orb => [orb.propId, {mood: orb.mood}] as const),
  ['prop-cube', {}],
  ['prop-pumpkinseed', {}],
])
describe('held magic items’ moods', () => {
  for (const [item, orb] of magicItems) {
    test(`${item.title} shares its alchemy orb’s mood only while held in the Forge`, () => {
      expect(flavorSteering.get(item.propId)).toBe(orb)
      expect(propMood(item.propId, props, 'forge')).toBe(moods[orb.mood])
      expect(propMood(`${item.propId}-2`, props, 'forge')).toBe(moods[orb.mood])
      for (const room of ['bastion', 'lodge', 'lobby', 'cell', 'arena']) {
        expect(propMood(item.propId, props, room)).toBeUndefined()
      }
      // Inspection alone never activates the magic item, even while it lies in the Forge.
      expect(propMood(item.propId, props)).toBeUndefined()
      // A removed or unmounted prop cannot cast a mood through a stale held id.
      expect(propMood(item.propId, new Map, 'forge')).toBeUndefined()
    })
    for (const activation of ['pickup', 'entry'] as const) {
      test(`${item.title} fades in on ${activation} and out on release or exit just like its orb`, () => {
        const mixer = new MoodMixer
        const orbMixer = new MoodMixer
        let held: string | null = activation === 'pickup' ? null : item.propId
        let room: 'bastion' | 'forge' = activation === 'pickup' ? 'forge' : 'bastion'
        const target = () => ({
          cast: propMood(held, props, room) ?? null,
          room: [moods[room]],
        })
        try {
          mixer.snap(target())
          expect(mixer.amountOf(moods[orb.mood])).toBe(0)
          held = item.propId
          room = 'forge'
          // The very same mood instance and fade curve as its orb, not a second effect.
          const orbTarget = {
            cast: propMood(orb.propId, props, room)!,
            room: [moods.forge],
          }
          for (let frame = 0; frame < 240; frame++) {
            mixer.update(target(), moodFade.in / 240)
            orbMixer.update(orbTarget, moodFade.in / 240)
            expect(mixer.amountOf(moods[orb.mood])).toBe(orbMixer.amountOf(moods[orb.mood]))
            if (frame === 119) {
              expect(mixer.amountOf(moods[orb.mood])).toBeCloseTo(0.5)
            }
          }
          expect(mixer.amountOf(moods[orb.mood])).toBeCloseTo(1)
          expect(mixer.amountOf(moods.forge)).toBe(1)
          if (activation === 'pickup') {
            held = null // dropping and throwing both clear held
          } else {
            room = 'bastion'
          }
          mixer.update(target(), moodFade.out / 2)
          expect(mixer.amountOf(moods[orb.mood])).toBeCloseTo(0.5)
          mixer.update(target(), moodFade.out)
          expect(mixer.amountOf(moods[orb.mood])).toBe(0)
        } finally {
          mixer.dispose()
          orbMixer.dispose()
        }
      })
    }
  }
  test('orbs keep their own moods in every room and while inspected', () => {
    for (const orb of orbs) {
      for (const room of ['forge', 'bastion', 'cell', undefined]) {
        expect(propMood(orb.propId, props, room)).toBe(orb.mood ? moods[orb.mood] : undefined)
      }
    }
    expect(propMood(helmet.propId, new Map([[helmet.propId, {mood: 'paint'}]]), 'forge')).toBe(moods.paint)
  })
  test('empty hands and ordinary props do not cast a mood', () => {
    for (const id of [null, '', 'prop-cube', 'prop-pumpkinseed', 'unknown']) {
      expect(propMood(id, props, 'forge')).toBeUndefined()
    }
  })
})
