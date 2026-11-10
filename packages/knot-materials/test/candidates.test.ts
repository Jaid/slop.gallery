import type {KnotCandidateData, KnotData} from '../src/types.ts'

import {describe, expect, test} from 'bun:test'

import {knotAnnouncementPaths, knotModelSlug} from '../src/announcements.ts'
import {enumerateKnotBays, formatKnotLabels, selectKnotBays} from '../src/exhibition.ts'
import KnotCandidate, {indexKnots} from '../src/KnotCandidate.ts'
import {knotCandidates, knots, special} from '../src/main.ts'

const candidateData: KnotCandidateData = {
  id: 'claude_fable',
  title: 'Claude Fable',
  icon: 'symbol.svg',
}
const item = (id: string, createdAt = 1_789_000_000): KnotData => ({
  id,
  title: id.replaceAll('_', ' '),
  createdAt,
  candidateId: 'claude_fable',
  placeholder: {
    color: '#ffffff',
    shading: 'smooth',
  },
  flavorText: 'A quiet relic of an impossible place.',
  author: {model: {title: 'Claude Fable 5.1'}},
})
const ids = (candidate: KnotCandidate) => candidate.select().map(entry => entry.id)
describe('arbitrary Knot batches', () => {
  test('places rarer entries at the far end while prioritizing them for shot limits', () => {
    const items = [item('washi_lantern'), item('lichtenberg_reliquary'), item('damascus_ember'), item('chladni_resonance'), item('glacial_aurora')]
    const candidate = new KnotCandidate(candidateData, items)
    const byDisplay = (a: typeof candidate.items[number], b: typeof candidate.items[number]) => a.rarity - b.rarity || b.createdAt - a.createdAt || a.id.localeCompare(b.id)
    const expected = candidate.items.toSorted(byDisplay)
    expect(ids(candidate)).toEqual(expected.map(entry => entry.id))
    expect(ids(new KnotCandidate(candidateData, items.toReversed()))).toEqual(expected.map(entry => entry.id))
    const limited = candidate.select(3)
    const expectedLimited = candidate.items.toSorted((a, b) => b.rarity - a.rarity || b.createdAt - a.createdAt || a.id.localeCompare(b.id)).slice(0, 3).toSorted(byDisplay)
    expect(limited.map(entry => entry.id)).toEqual(expectedLimited.map(entry => entry.id))
    expect(limited.map(entry => entry.rarity)).toEqual(expectedLimited.map(entry => entry.rarity))
    expect(() => candidate.select(0)).toThrow('shot limit')
  })
  test('newer knots win rarity ties without outranking older knots of higher rarity', () => {
    const candidate = new KnotCandidate(candidateData, [
      item('damascus_ember', 1_789_000_100),
      item('glacial_aurora', 1_789_000_300),
      item('kintsugi_obsidian', 1_789_000_300),
      item('lichtenberg_reliquary', 1_788_000_000),
      item('chladni_resonance', 1_787_000_000),
    ])
    expect(candidate.select(1).map(entry => entry.id)).toEqual(['chladni_resonance'])
    expect(candidate.select(3).map(entry => entry.id)).toEqual(['glacial_aurora', 'lichtenberg_reliquary', 'chladni_resonance'])
    expect(candidate.select(4).map(entry => entry.id)).toEqual(['glacial_aurora', 'kintsugi_obsidian', 'lichtenberg_reliquary', 'chladni_resonance'])
    expect(candidate.select().map(entry => entry.id)).toEqual(['glacial_aurora', 'kintsugi_obsidian', 'damascus_ember', 'lichtenberg_reliquary', 'chladni_resonance'])
    expect(candidate.select(3, {rarity: false}).map(entry => entry.id)).toEqual(['chladni_resonance', 'damascus_ember', 'glacial_aurora'])
  })
  test('handles empty and partial rows without padding', () => {
    expect(ids(new KnotCandidate(candidateData, []))).toEqual([])
    const candidate = new KnotCandidate(candidateData, [item('damascus_ember'), item('chladni_resonance')])
    expect(ids(candidate)).toEqual(['damascus_ember', 'chladni_resonance'])
  })
  test('rejects invalid identifiers, duplicate IDs and displacement bounds', () => {
    expect(() => new KnotCandidate({
      ...candidateData,
      id: '../fable',
    }, [])).toThrow('ID')
    expect(() => new KnotCandidate(candidateData, [
      {
        ...item('damascus_ember'),
        id: '../other',
      },
    ])).toThrow('ID')
    expect(() => new KnotCandidate(candidateData, [item('damascus_ember'), item('damascus_ember')])).toThrow('ID')
    for (const displacement of [-1, Number.NaN, Infinity]) {
      expect(() => new KnotCandidate(candidateData, [
        {
          ...item('damascus_ember'),
          displacement,
        },
      ])).toThrow('displacement')
    }
    expect(() => new KnotCandidate(candidateData, [
      {
        ...item('damascus_ember'),
        author: {model: {title: ' '}},
      },
    ])).toThrow('author')
  })
  test('indexes globally unique IDs and rejects duplicate candidates or cross-candidate collisions', () => {
    const a = new KnotCandidate(candidateData, [item('damascus_ember')])
    const astra = {
      ...candidateData,
      id: 'gpt_astra',
    }
    const b = new KnotCandidate(astra, [{
      ...item('lenticular_mirage'),
      candidateId: 'gpt_astra',
    }])
    expect(indexKnots([a, b]).keys().toArray()).toEqual(['damascus_ember', 'lenticular_mirage'])
    const duplicate = new KnotCandidate(astra, [{
      ...item('damascus_ember'),
      candidateId: 'gpt_astra',
    }])
    expect(() => indexKnots([a, duplicate])).toThrow('Duplicate Knot ID')
    expect(() => indexKnots([a, a])).toThrow('candidate')
  })
  test('uses canonical candidate and model IDs', () => {
    for (const candidate of knotCandidates) {
      expect(candidate.data.id).toMatch(/^[a-z][0-9_a-z]*$/u)
    }
    for (const entry of knots) {
      expect(knotAnnouncementPaths(entry).model.split('/slug/')[1], entry.id).toMatch(/^[0-9a-z][-.0-9a-z]*$/u)
      if (entry.author.model.slug) {
        expect(entry.author.model.slug, entry.id).toMatch(/^[-0-9a-z]+\/[-.0-9a-z]+$/u)
      }
    }
  })
  test('uses candidate titles independently from author model titles', () => {
    const fable = knotCandidates.find(candidate => candidate.data.id === 'claude_fable')!
    expect(fable.data.title).toBe('Claude Fable')
    expect(fable.items.every(entry => entry.modelTitle === 'Claude Fable 5.1')).toBe(true)
  })
  test('collapses effort labels and spelling variants into one model identity', () => {
    for (const [slug, grouped] of Map.groupBy(knots, knotModelSlug)) {
      const modelTitles = new Set(grouped.map(entry => entry.modelTitle))
      expect(modelTitles.size, slug).toBe(1)
    }
  })
  test('credits API and Mage entries with a model slug', () => {
    const apiAndMageEntries = knots.filter(knot => knot.harness === 'none' || knot.harness === 'Mage')
    for (const entry of apiAndMageEntries) {
      expect(entry.author.model.slug, entry.id).toBeDefined()
    }
  })
  test('defaults to four shots per candidate when the URL omits shots', () => {
    const bays = selectKnotBays('?candidate=claude_fable,gpt_astra')
    expect(new Set(bays.map(bay => bay.candidate.data.id))).toEqual(new Set(['claude_fable', 'gpt_astra']))
    expect(bays.every(bay => bay.finishes.length === 4)).toBe(true)
  })
  test('filters candidates, caps shots and enumerates only after final selection', () => {
    const bays = selectKnotBays('?candidate=glm,muse_spark,qwen_max,gpt_astra&shots=2')
    expect(new Set(bays.map(bay => bay.candidate.data.id))).toEqual(new Set(['glm', 'muse_spark', 'qwen_max', 'gpt_astra']))
    expect(bays.flatMap(bay => bay.finishes)).toHaveLength(8)
    expect(bays.every(bay => bay.finishes.length === 2 && bay.finishes.every(entry => entry.candidate.id === bay.candidate.data.id))).toBe(true)
    const numbered = enumerateKnotBays(bays)
    expect(numbered.flatMap(bay => bay.finishes.map(entry => entry.number))).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    const astra = enumerateKnotBays(selectKnotBays('?candidate=gpt_astra&shots=3'))
    expect(astra[0].finishes).toHaveLength(3)
    expect(astra[0].finishes.map(entry => entry.number)).toEqual([1, 2, 3])
    expect(() => selectKnotBays('?shots=0')).toThrow('shots')
    expect(() => selectKnotBays('?candidate_limit=0')).toThrow('candidate_limit')
    expect(() => selectKnotBays('?candidate=missing')).toThrow('candidate')
  })
  test('model filters a mixed candidate before the shot cap', () => {
    const candidate = knotCandidates.find(entryCandidate => {
      const models = new Set(entryCandidate.items.map(knotModelSlug))
      return models.size > 1
    })!
    const model = knotModelSlug(candidate.items[0])
    const bays = selectKnotBays(`?model=${model}&shots=3`)
    expect(bays).toHaveLength(1)
    expect(bays[0].candidate.data.id).toBe(candidate.data.id)
    expect(bays[0].finishes).toHaveLength(3)
    expect(bays[0].finishes.every(entry => knotModelSlug(entry) === model)).toBe(true)
    const available = candidate.items.filter(entry => entry.rarity !== special && knotModelSlug(entry) === model)
    const selected = new Set(bays[0].finishes.map(entry => entry.id))
    const omitted = available.filter(entry => !selected.has(entry.id))
    if (omitted.length) {
      expect(Math.min(...bays[0].finishes.map(entry => entry.rarity))).toBeGreaterThanOrEqual(Math.max(...omitted.map(entry => entry.rarity)))
    }
    expect(() => selectKnotBays('?model=missing-model')).toThrow('Knot model')
  })
  test('knot_id is an exact comma-separated exhibition whitelist', () => {
    const requested = knotCandidates.slice(0, 9).map(entryCandidate => entryCandidate.items[0].id)
    const bays = selectKnotBays(`?knot_id=${requested.join(',')}`)
    expect(new Set(bays.flatMap(bay => bay.finishes.map(entry => entry.id)))).toEqual(new Set(requested))
    expect(bays).toHaveLength(9)
    const candidateWithFive = knotCandidates.find(entryCandidate => entryCandidate.items.length >= 5)!
    const five = candidateWithFive.items.slice(0, 5).map(knot => knot.id)
    const exact = selectKnotBays(`?knot_id=${five.join(',')}`)
    expect(exact).toHaveLength(1)
    expect(new Set(exact[0].finishes.map(entry => entry.id))).toEqual(new Set(five))
    expect(exact[0].finishes).toHaveLength(5)
    expect(() => selectKnotBays('?knot_id=missing_knot')).toThrow('Knot ID')
  })
  test('formats runtime number sequences compactly', () => {
    expect(formatKnotLabels([])).toBe('')
    expect(formatKnotLabels([1])).toBe('#01')
    expect(formatKnotLabels([1, 2, 3])).toBe('#01–#03')
    expect(formatKnotLabels([1, 3, 4])).toBe('#01 · #03 · #04')
  })
})
