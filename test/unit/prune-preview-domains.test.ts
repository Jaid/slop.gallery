import type {PruneLimits, PullRequestState} from '../../scripts/prunePreviewDomains.ts'

import {expect, test} from 'bun:test'

import {selectPrunedDomains, toPullRequestDomains} from '../../scripts/prunePreviewDomains.ts'

const open = (createdAt: string): PullRequestState => ({
  createdAt: new Date(createdAt),
  open: true,
})
const closed = (createdAt: string, closedAt: string): PullRequestState => ({
  closedAt: new Date(closedAt),
  createdAt: new Date(createdAt),
  open: false,
})
const pullRequests = new Map([
  [1, closed('2026-10-01', '2026-11-05')],
  [2, closed('2026-10-02', '2026-10-20')],
  [3, open('2026-10-03')],
  [4, open('2026-09-01')],
  [5, closed('2026-10-05', '2026-10-25')],
])
const domains = toPullRequestDomains(['pr-1', 'pr-2', 'pr-3', 'pr-4', 'pr-5'])
const prune = (limits: PruneLimits) => selectPrunedDomains(domains, pullRequests, limits).map(domain => domain.alias)
test('only the domains of pull requests count, not those of branches like main', () => {
  expect(toPullRequestDomains(['main', 'pr-12', 'pr-', 'pr-3a', 'xpr-4', 'pr-007'])).toEqual([
    {
      alias: 'pr-12',
      number: 12,
    },
    {
      alias: 'pr-007',
      number: 7,
    },
  ])
})
test('closed pull requests go before open ones, those that closed or opened longest ago first', () => {
  expect(prune({maximum: 0})).toEqual(['pr-2', 'pr-5', 'pr-1', 'pr-4', 'pr-3'])
  expect(prune({maximum: 2})).toEqual(['pr-2', 'pr-5', 'pr-1'])
  expect(prune({maximum: 1})).toEqual(['pr-2', 'pr-5', 'pr-1', 'pr-4'])
})
test('nothing goes with no more domains than the maximum', () => {
  expect(prune({maximum: 5})).toEqual([])
  expect(prune({maximum: 8})).toEqual([])
})
test('nothing goes with fewer domains than the minimum, but everything past the maximum once they reach it', () => {
  expect(prune({
    minimum: 6,
    maximum: 3,
  })).toEqual([])
  expect(prune({
    minimum: 5,
    maximum: 3,
  })).toEqual(['pr-2', 'pr-5'])
})
test('domains of pull requests GitHub doesn’t know go first, ties by number', () => {
  const unknown = toPullRequestDomains(['pr-9', 'pr-3', 'pr-8', 'pr-1'])
  expect(selectPrunedDomains(unknown, pullRequests, {maximum: 1}).map(domain => domain.alias)).toEqual(['pr-8', 'pr-9', 'pr-1'])
})
