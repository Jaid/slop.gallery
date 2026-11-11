import {parseArgs} from 'node:util'

import {detachPreviewDomain, listPreviewDomains} from './previewDomain.ts'

/** a preview domain of a pull request, pr-<number>.slop.gallery */
export type PullRequestDomain = {
  alias: string
  number: number
}

/** the pull request as far as pruning cares, missing if GitHub doesn’t know it */
export type PullRequestState = {
  closedAt?: Date
  createdAt: Date
  open: boolean
}

export type PruneLimits = {
  maximum: number
  minimum?: number
}

type PullRequest = {
  closed_at: string | null
  created_at: string
  number: number
  state: 'closed' | 'open'
}

const repository = Bun.env.GITHUB_REPOSITORY ?? 'Jaid/slop.gallery'
const help = [
  'Usage: bun scripts/prunePreviewDomains.ts --maximum <count> [--minimum <count>] [--dry-run]',
  '',
  'Detaches the pr-<number> preview domains past <maximum> of them, those of closed pull requests first, which closed longest ago, then those of open ones, which opened longest ago.',
  'With fewer than <minimum> of them, it leaves them all. Other preview domains, like main’s, neither count nor go.',
  'Needs CLOUDFLARE_API_TOKEN like scripts/previewDomain.ts and reads the pull requests through GITHUB_TOKEN if given.',
  '',
  'Options:',
  '  --maximum <count>   the pr-<number> domains to keep at most',
  '  --minimum <count>   the pr-<number> domains below which nothing goes. Default: 0',
  '  --dry-run           only print the domains that would go',
  '  -h, --help          show this help',
].join('\n')
const pullRequestAlias = /^pr-(?<number>\d+)$/
const parseCount = (value: string | undefined, name: string) => {
  if (value === undefined || !/^\d+$/.test(value.trim())) {
    throw new TypeError(`--${name} needs a count, got “${value}”.`)
  }
  return Number(value)
}

export const toPullRequestDomains = (aliases: Array<string>) => {
  const domains: Array<PullRequestDomain> = []
  for (const alias of aliases) {
    const number = pullRequestAlias.exec(alias)?.groups?.number
    if (number) {
      domains.push({
        alias,
        number: Number(number),
      })
    }
  }
  return domains
}

/** Picks the domains that go to leave `maximum` of them: those of closed pull requests or ones GitHub doesn’t know first, longest closed first, then those of open ones, longest open first. */
export const selectPrunedDomains = (domains: Array<PullRequestDomain>, pullRequests: Map<number, PullRequestState>, {minimum = 0, maximum}: PruneLimits) => {
  if (domains.length < minimum || domains.length <= maximum) {
    return []
  }
  const rank = (domain: PullRequestDomain) => {
    const pullRequest = pullRequests.get(domain.number)
    if (!pullRequest) {
      return [0, Number.NEGATIVE_INFINITY] as const
    }
    if (pullRequest.open) {
      return [1, pullRequest.createdAt.getTime()] as const
    }
    return [0, (pullRequest.closedAt ?? pullRequest.createdAt).getTime()] as const
  }
  const sorted = domains.toSorted((a, b) => {
    const [groupA, dateA] = rank(a)
    const [groupB, dateB] = rank(b)
    return groupA - groupB || dateA - dateB || a.number - b.number
  })
  return sorted.slice(0, domains.length - maximum)
}

const fetchPullRequests = async () => {
  const pullRequests = new Map<number, PullRequestState>
  const headers: Record<string, string> = {Accept: 'application/vnd.github+json'}
  if (Bun.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${Bun.env.GITHUB_TOKEN}`
  }
  for (let page = 1; ; page++) {
    const response = await fetch(`https://api.github.com/repos/${repository}/pulls?state=all&per_page=100&page=${page}`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      throw new Error(`GitHub answered the pull requests of ${repository} with HTTP ${response.status}.`)
    }
    const batch = await response.json() as Array<PullRequest>
    for (const pullRequest of batch) {
      pullRequests.set(pullRequest.number, {
        closedAt: pullRequest.closed_at ? new Date(pullRequest.closed_at) : undefined,
        createdAt: new Date(pullRequest.created_at),
        open: pullRequest.state === 'open',
      })
    }
    if (batch.length < 100) {
      return pullRequests
    }
  }
}
/** Resolves with the aliases of the domains it detached, or would detach with `dryRun`. */
const main = async ({dryRun = false, ...limits}: PruneLimits & {dryRun?: boolean}) => {
  const [previewDomains, pullRequests] = await Promise.all([listPreviewDomains(), fetchPullRequests()])
  const domains = toPullRequestDomains(previewDomains.map(domain => domain.alias))
  const pruned = selectPrunedDomains(domains, pullRequests, limits)
  if (domains.length < (limits.minimum ?? 0)) {
    console.log(`There are ${domains.length} pr-<number> domains, fewer than the minimum of ${limits.minimum}, so all of them stay.`)
    return []
  }
  console.log(`There are ${domains.length} pr-<number> domains, ${pruned.length} of which ${dryRun ? 'would go' : 'go'} to keep at most ${limits.maximum}.`)
  for (const domain of pruned) {
    const pullRequest = pullRequests.get(domain.number)
    const state = pullRequest ? (pullRequest.open ? 'open' : 'closed') : 'unknown'
    if (dryRun) {
      console.log(`Would detach ${domain.alias} (${state}).`)
      continue
    }
    console.log(`Detaching ${domain.alias} (${state}).`)
    await detachPreviewDomain(domain.alias)
  }
  return pruned.map(domain => domain.alias)
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    strict: true,
    options: {
      maximum: {type: 'string'},
      minimum: {type: 'string'},
      'dry-run': {type: 'boolean'},
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else if (values.maximum === undefined) {
    console.log(help)
    process.exitCode = 1
  } else {
    await main({
      maximum: parseCount(values.maximum, 'maximum'),
      minimum: values.minimum === undefined ? 0 : parseCount(values.minimum, 'minimum'),
      dryRun: values['dry-run'],
    })
  }
}
