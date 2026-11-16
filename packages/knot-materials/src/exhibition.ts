import type {KnotEntry, Vec3} from './types.ts'

import {knotModelSlug} from './announcements.ts'
import parseCandidateOrder from './candidateOrder.ts'
import KnotLayout from './KnotLayout.ts'
import {knotCandidates} from './main.ts'
import {special as specialRarity, unknown as unknownRarity} from './rarities.ts'
import parseRarityFilter from './rarityFilter.ts'
import parseRarityMode from './rarityMode.ts'

export const knotFloatHeight = 1

/** Curatorial score of a candidate row. Unknown and special entries are excluded, so neither lifts nor lowers it. */
export function candidateScore(candidate: typeof knotCandidates[number]) {
  const rated = candidate.items.filter(item => item.rarity !== unknownRarity && item.rarity !== specialRarity)
  if (!rated.length) {
    return 1.1
  }
  const average = rated.reduce((sum, item) => sum + item.rarity, 0) / rated.length
  const best = rated.toSorted((a, b) => b.rarity - a.rarity).slice(0, 6)
  const bestAverage = best.reduce((sum, item) => sum + item.rarity, 0) / best.length
  return (bestAverage + average) / 2
}

export function selectKnotBays(search = '') {
  const params = new URLSearchParams(search)
  function positiveIntegerParam(name: string, fallback: number) {
    const raw = params.get(name)
    if (raw === null) {
      return fallback
    }
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`Knot ${name} URL parameter must be a positive integer.`)
    }
    return value
  }
  const rarityMode = parseRarityMode(search)
  const rarityFilter = parseRarityFilter(search)
  const candidateOrder = parseCandidateOrder(search)
  const requested = [...new Set(params.getAll('candidate').flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean))]
  const known = new Set(knotCandidates.map(candidate => candidate.data.id))
  const unknown = requested.filter(id => !known.has(id))
  if (unknown.length) {
    throw new Error(`Unknown Knot candidate URL selection: ${unknown.join(', ')}`)
  }
  const requestedKnotIds = [...new Set(params.getAll('knot_id').flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean))]
  const requestedModel = params.get('model')?.trim() || undefined
  const knownModels = new Set(knotCandidates.flatMap(candidate => candidate.items.map(knotModelSlug)))
  if (requestedModel && !knownModels.has(requestedModel)) {
    throw new Error(`Unknown Knot model URL selection: ${requestedModel}`)
  }
  const modelFilter = requestedModel ? (item: KnotEntry) => knotModelSlug(item) === requestedModel : undefined
  const knownKnotIds = new Set(knotCandidates.flatMap(candidate => candidate.items.map(item => item.id)))
  const unknownKnotIds = requestedKnotIds.filter(id => !knownKnotIds.has(id))
  if (unknownKnotIds.length) {
    throw new Error(`Unknown Knot ID URL selection: ${unknownKnotIds.join(', ')}`)
  }
  const shots = positiveIntegerParam('shots', 4)
  const candidateLimit = positiveIntegerParam('candidate_limit', 8)
  const requestedKnotIdSet = new Set(requestedKnotIds)
  const exactKnotSelection = requestedKnotIds.length > 0
  // Special knots are only shown when intentionally requested by ID or by a rarity filter that names them.
  const selection = {
    rarity: rarityMode !== 'false',
    rarityFilter,
    includeSpecial: exactKnotSelection || rarityFilter?.has(specialRarity) || false,
    filter: (item: KnotEntry) => (!exactKnotSelection || requestedKnotIdSet.has(item.id)) && (!modelFilter || modelFilter(item)),
  }
  let selected = knotCandidates
  if (!exactKnotSelection && requested.length) {
    selected = selected.filter(candidate => requested.includes(candidate.data.id))
  }
  // Rows without an eligible knot must not take a slot under candidate_limit.
  selected = selected.filter(candidate => candidate.select(1, selection).length > 0)
  const byName = (a: typeof knotCandidates[number], b: typeof knotCandidates[number]) => a.data.title.localeCompare(b.data.title) || a.data.id.localeCompare(b.data.id)
  const byScore = (a: typeof knotCandidates[number], b: typeof knotCandidates[number]) => candidateScore(b) - candidateScore(a) || byName(a, b)
  const ordered = selected.toSorted(candidateOrder === 'score' ? byScore : byName)
  const candidates = exactKnotSelection ? ordered : ordered.slice(0, candidateLimit)
  return candidates.map(candidate => ({
    candidate,
    finishes: candidate.select(exactKnotSelection ? undefined : shots, selection),
  }))
}

export function enumerateKnotBays(bays: ReturnType<typeof selectKnotBays>) {
  let number = 0
  return bays.map(({candidate, finishes}) => ({
    candidate,
    finishes: finishes.map(finish => ({
      ...finish,
      number: ++number,
    })),
  }))
}

const search = typeof location === 'undefined' ? '' : location.search
export const knotRarityMode = parseRarityMode(search)
const selectedBays = enumerateKnotBays(selectKnotBays(search))
export const knotLayout = new KnotLayout(selectedBays.map(bay => bay.finishes.length))
export const knotSpacing = knotLayout.itemSpacing
export const knotNumberLabel = (number: number) => `#${String(number).padStart(2, '0')}`

export function formatKnotLabels(numbers: ReadonlyArray<number>) {
  if (numbers.length > 1 && numbers.every((number, index) => index === 0 || number === numbers[index - 1] + 1)) {
    return `${knotNumberLabel(numbers[0])}–${knotNumberLabel(numbers.at(-1)!)}`
  }
  return numbers.map(knotNumberLabel).join(' · ')
}

export const knotBays = selectedBays.map(({candidate, finishes}, index) => ({
  candidate: candidate.data,
  finishes,
  labels: formatKnotLabels(finishes.map(item => item.number)),
  center: [0, 0, knotLayout.rowZ(index)] as Vec3,
}))

export const knotRowHalfWidth = knotLayout.rowHalfWidth

export const knotExhibition = knotBays.flatMap(bay => bay.finishes.map((finish, index) => ({
  ...finish,
  label: knotNumberLabel(finish.number),
  position: [index * knotSpacing - knotRowHalfWidth, 0, bay.center[2]] as Vec3,
  rotation: 0,
})))
export type KnotExhibit = typeof knotExhibition[number]
export type KnotBay = typeof knotBays[number]
export type NumberedKnot = KnotEntry & {number: number}

/** x of the row billboards, or null when the exhibition is a single Knot in a plain room without billboard */
export const knotPreviewX = knotLayout.previewX
