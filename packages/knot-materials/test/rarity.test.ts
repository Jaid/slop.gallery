import {describe, expect, test} from 'bun:test'

import parseCandidateOrder from '../src/candidateOrder.ts'
import {candidateScore, knotPreviewX, knotRowHalfWidth, knotSpacing, selectKnotBays} from '../src/exhibition.ts'
import KnotRarityEditor from '../src/KnotRarityEditor.ts'
import {KnotCandidate, knotCandidates, knots, knotsById} from '../src/main.ts'
import {special} from '../src/rarities.ts'
import parseRarityFilter from '../src/rarityFilter.ts'
import parseRarityMode from '../src/rarityMode.ts'

describe('rarity selection policy', () => {
  test('parses exactly true, false and edit, defaulting to true', () => {
    expect(parseRarityMode()).toBe('true')
    for (const mode of ['true', 'false', 'edit'] as const) {
      expect(parseRarityMode(`?rarity=${mode}`)).toBe(mode)
    }
    for (const value of ['', '1', 'yes', 'EDIT']) {
      expect(() => parseRarityMode(`?rarity=${value}`)).toThrow('rarity')
    }
  })
  test('parses rarity filters as numeric tiers or enum names', () => {
    expect(parseRarityFilter()).toBeUndefined()
    expect([...parseRarityFilter('?rarity_filter=0')!]).toEqual([0])
    expect([...parseRarityFilter('?rarity_filter=unknown,rare,4')!]).toEqual([0, 2, 4])
    expect([...parseRarityFilter('?rarity_filter=common&rarity_filter=3,ethereal')!]).toEqual([1, 3, 4])
    expect([...parseRarityFilter('?rarity_filter=0,unknown,0')!]).toEqual([0])
    expect([...parseRarityFilter('?rarity_filter=special')!]).toEqual([5])
    expect([...parseRarityFilter('?rarity_filter=5,special,ethereal')!]).toEqual([5, 4])
    for (const value of ['', '6', '-1', '1.5', 'UNKNOWN', 'SPECIAL', 'legendary', '0,,1']) {
      expect(() => parseRarityFilter(`?rarity_filter=${value}`)).toThrow('rarity_filter')
    }
  })
  test('filters before shot and candidate limits and composes with edit and knot_id', () => {
    const unknownBays = selectKnotBays('?rarity=edit&rarity_filter=0')
    expect(unknownBays).toHaveLength(Math.min(8, knotCandidates.filter(candidate => candidate.items.some(item => item.rarity === 0)).length))
    expect(unknownBays.every(bay => bay.finishes.length > 0 && bay.finishes.length <= 4)).toBe(true)
    expect(unknownBays.flatMap(bay => bay.finishes).every(item => item.rarity === 0)).toBe(true)
    const mixed = selectKnotBays('?rarity_filter=unknown,rare&candidate_limit=3&shots=2')
    expect(mixed).toHaveLength(3)
    expect(mixed.every(bay => bay.finishes.length <= 2 && bay.finishes.every(item => item.rarity === 0 || item.rarity === 2))).toBe(true)
    const rareItem = knots.find(item => item.rarity === 2)!
    const otherItem = knots.find(item => item.rarity !== 2)!
    const exact = selectKnotBays(`?knot_id=${rareItem.id},${otherItem.id}&rarity_filter=rare`)
    expect(exact.flatMap(bay => bay.finishes).map(item => item.id)).toEqual([rareItem.id])
  })
  test('omits lower rarities first for every shot cap and places rarer knots away from the billboard', () => {
    expect(knotPreviewX).not.toBeNull()
    for (const candidate of knotCandidates) {
      const available = candidate.items.filter(item => item.rarity !== special)
      const prioritized = available.toSorted((a, b) => b.rarity - a.rarity || b.createdAt - a.createdAt || a.id.localeCompare(b.id))
      for (let limit = 1; limit <= available.length; limit++) {
        const selected = candidate.select(limit)
        const ids = new Set(selected.map(item => item.id))
        const omitted = available.filter(item => !ids.has(item.id))
        expect(selected).toHaveLength(limit)
        const expected = prioritized.slice(0, limit).toSorted((a, b) => a.rarity - b.rarity || b.createdAt - a.createdAt || a.id.localeCompare(b.id))
        expect(selected.map(item => item.id)).toEqual(expected.map(item => item.id))
        if (omitted.length) {
          expect(Math.min(...selected.map(item => item.rarity))).toBeGreaterThanOrEqual(Math.max(...omitted.map(item => item.rarity)))
        }
        let prior = 0
        for (const [index, item] of selected.entries()) {
          expect(item.rarity).toBeGreaterThanOrEqual(prior)
          expect(index * knotSpacing - knotRowHalfWidth).toBeGreaterThan(knotPreviewX!)
          prior = item.rarity
        }
      }
    }
  })
  test('false bypasses rarity for both omissions and ordering; edit starts from the true selection', () => {
    for (const candidate of knotCandidates) {
      const search = `?candidate=${candidate.data.id}&shots=3`
      const selected = selectKnotBays(`${search}&rarity=false`)[0]?.finishes ?? []
      const expected = candidate.items.filter(item => item.rarity !== special).toSorted((a, b) => a.id.localeCompare(b.id)).slice(0, 3)
      expect(selected.map(item => item.id)).toEqual(expected.map(item => item.id))
      expect(selectKnotBays(`${search}&rarity=edit`)).toEqual(selectKnotBays(`${search}&rarity=true`))
    }
  })
})
describe('candidate ordering', () => {
  test('parses score and name, defaulting to score', () => {
    expect(parseCandidateOrder()).toBe('score')
    expect(parseCandidateOrder('?candidate_order=score')).toBe('score')
    expect(parseCandidateOrder('?candidate_order=name')).toBe('name')
    for (const value of ['', 'rarity', 'SCORE']) {
      expect(() => parseCandidateOrder(`?candidate_order=${value}`)).toThrow('candidate_order')
    }
  })
  test('score equally blends the best-six and overall known rarity averages and the default selects the best eight candidates', () => {
    for (const candidate of knotCandidates) {
      const rated = candidate.items.filter(item => item.rarity !== 0 && item.rarity !== special)
      if (!rated.length) {
        expect(candidateScore(candidate)).toBe(1.1)
        continue
      }
      const average = rated.reduce((sum, item) => sum + item.rarity, 0) / rated.length
      const best = rated.toSorted((a, b) => b.rarity - a.rarity).slice(0, 6)
      const bestAverage = best.reduce((sum, item) => sum + item.rarity, 0) / best.length
      expect(candidateScore(candidate)).toBe((bestAverage + average) / 2)
    }
    expect(knotCandidates.filter(candidate => candidate.items.every(item => item.rarity === 0 || item.rarity === special)).every(candidate => candidateScore(candidate) === 1.1)).toBe(true)
    const bays = selectKnotBays()
    const scores = bays.map(bay => candidateScore(bay.candidate))
    expect(bays).toHaveLength(8)
    expect(bays.every(bay => bay.finishes.length === 4)).toBe(true)
    expect(scores).toEqual(scores.toSorted((a, b) => b - a))
  })
  test('candidate_limit truncates after candidate ordering', () => {
    const byScore = selectKnotBays('?candidate_limit=3')
    expect(byScore).toHaveLength(3)
    const expectedByScore = knotCandidates.toSorted((a, b) => candidateScore(b) - candidateScore(a)
      || a.data.title.localeCompare(b.data.title)
      || a.data.id.localeCompare(b.data.id))
      .slice(0, 3)
    expect(byScore.map(bay => bay.candidate.data.id)).toEqual(expectedByScore.map(candidate => candidate.data.id))
    const byName = selectKnotBays('?candidate_order=name&candidate_limit=3')
    const expectedByName = knotCandidates.toSorted((a, b) => a.data.title.localeCompare(b.data.title) || a.data.id.localeCompare(b.data.id))
      .slice(0, 3)
    expect(byName.map(bay => bay.candidate.data.id)).toEqual(expectedByName.map(candidate => candidate.data.id))
    for (const value of ['0', '-1', '1.5', '']) {
      expect(() => selectKnotBays(`?candidate_limit=${value}`)).toThrow('candidate_limit')
    }
  })
  test('name sorts by candidate title', () => {
    const bays = selectKnotBays('?candidate_order=name')
    const titles = bays.map(bay => bay.candidate.data.title)
    expect(titles).toEqual(titles.toSorted((a, b) => a.localeCompare(b)))
  })
})
const shown = (search?: string) => new Set(selectKnotBays(search).flatMap(bay => bay.finishes.map(item => item.id)))
describe('special rarity', () => {
  const specialIds = ['felis_major_menagerie', 'great_cat_emergence', 'knotty_prince']
  const specialKnots = knots.filter(item => item.rarity === special)
  test('is a five-star tier above ethereal assigned to the three curated knots', () => {
    expect(special).toBe(5)
    expect(specialKnots.map(item => item.id).toSorted()).toEqual(specialIds)
    expect(specialIds.map(id => knotsById.get(id)!.title).toSorted()).toEqual(['Felis Major Menagerie', 'Great Cat Emergence', 'Knotty Prince'])
  })
  test('never enters an automatic selection, whatever the caps, order, model, candidate or rarity mode', () => {
    const searches = [
      '',
      '?shots=1000&candidate_limit=1000',
      '?shots=1000&candidate_limit=1000&candidate_order=name',
      '?shots=1000&candidate_limit=1000&rarity=false',
      '?shots=1000&candidate_limit=1000&rarity=edit',
      ...[...new Set(specialKnots.map(item => item.candidateId))].map(id => `?candidate=${id}&shots=1000`),
      '?model=claude-opus-5.5&shots=1000',
      '?rarity_filter=0,1,2,3,4&shots=1000&candidate_limit=1000',
    ]
    for (const search of searches) {
      const ids = shown(search)
      expect(ids.size, search).toBeGreaterThan(0)
      for (const id of specialIds) {
        expect(ids.has(id), `${search} shows ${id}`).toBe(false)
      }
    }
    for (const candidate of knotCandidates) {
      expect(candidate.select().some(item => item.rarity === special)).toBe(false)
      expect(candidate.select(undefined, {rarity: false}).some(item => item.rarity === special)).toBe(false)
    }
  })
  test('shows when intentionally requested by knot_id or rarity_filter', () => {
    expect(shown(`?knot_id=${specialIds.join(',')}`)).toEqual(new Set(specialIds))
    expect(shown('?knot_id=knotty_prince')).toEqual(new Set(['knotty_prince']))
    expect(shown('?rarity_filter=special&shots=1000')).toEqual(new Set(specialIds))
    expect(shown('?rarity_filter=5&shots=1000')).toEqual(new Set(specialIds))
    const mixed = shown('?rarity_filter=ethereal,special&shots=1000&candidate_limit=1000')
    expect(knots.filter(item => item.rarity === 4 || item.rarity === special).every(item => mixed.has(item.id))).toBe(true)
    expect([...mixed].every(id => [4, special].includes(knotsById.get(id)!.rarity))).toBe(true)
    const rareItem = knots.find(item => item.rarity === 2)!
    expect(shown(`?knot_id=knotty_prince,${rareItem.id}&rarity_filter=rare`)).toEqual(new Set([rareItem.id]))
    expect(shown(`?knot_id=knotty_prince,${rareItem.id}&rarity_filter=special`)).toEqual(new Set(['knotty_prince']))
    const explicit = knotCandidates.find(candidate => candidate.data.id === 'claude_opus')!
    expect(explicit.select(undefined, {includeSpecial: true}).filter(item => item.rarity === special).map(item => item.id)).toEqual(specialIds.toSorted((a, b) => knotsById.get(b)!.createdAt - knotsById.get(a)!.createdAt || a.localeCompare(b)))
  })
  test('is excluded from candidate scores', () => {
    const affected = knotCandidates.filter(entry => entry.items.some(item => item.rarity === special))
    expect(affected.length).toBeGreaterThan(0)
    for (const candidate of affected) {
      const withoutSpecial = new KnotCandidate(candidate.data, candidate.items.filter(item => item.rarity !== special))
      expect(withoutSpecial.items.length).toBeLessThan(candidate.items.length)
      expect(candidateScore(candidate)).toBe(candidateScore(withoutSpecial))
    }
    const onlySpecial = new KnotCandidate(specialKnots[0].candidate, specialKnots)
    expect(candidateScore(onlySpecial)).toBe(1.1)
  })
  test('filters drop special knots before rows are formed, leaving no empty rows', () => {
    const opus = knotCandidates.find(candidate => candidate.data.id === 'claude_opus')!
    const onlySpecialModel = 'claude-opus-5.5'
    const nonSpecialOpus55 = opus.items.filter(item => item.rarity !== special && item.author.model.slug?.endsWith(onlySpecialModel))
    const bays = selectKnotBays(`?model=${onlySpecialModel}&shots=1000`)
    expect(bays.every(bay => bay.finishes.length > 0)).toBe(true)
    expect(bays.flatMap(bay => bay.finishes).map(item => item.id).toSorted()).toEqual(nonSpecialOpus55.map(item => item.id).toSorted())
    const ethereal = selectKnotBays('?rarity_filter=ethereal&candidate_limit=1000')
    expect(ethereal.every(bay => bay.finishes.length > 0 && bay.finishes.every(item => item.rarity === 4))).toBe(true)
  })
})
test('a session edit cycles through every tier without mutating the source or an earlier snapshot', () => {
  const item = {
    ...knots[0],
    rarity: special,
  } as const
  const editor = new KnotRarityEditor([item])
  const original = editor.getSnapshot()
  let notifications = 0
  const unsubscribe = editor.subscribe(() => notifications++)
  for (const value of [0, 1, 2, 3, 4, 5] as const) {
    expect(editor.cycle(item.id)).toBe(value)
    expect(editor.getSnapshot().get(item.id)).toBe(value)
    expect(original.get(item.id)).toBe(special)
    expect(item.rarity).toBe(special)
  }
  expect(notifications).toBe(6)
  unsubscribe()
  editor.cycle(item.id)
  expect(notifications).toBe(6)
  expect(() => editor.cycle('not_a_knot')).toThrow('Unknown Knot ID')
})
