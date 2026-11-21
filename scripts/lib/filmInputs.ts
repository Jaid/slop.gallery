import type {Arrayable} from 'type-fest'

import {join, resolve, sep} from 'node:path'

import {globby, isDynamicPattern} from 'globby'
import {Minimatch} from 'minimatch'

import {maximumSeed, parseSeed, rolledSeeds} from '#src/lib/environmentSeed.ts'

export const defaultSeedRange = `0..${rolledSeeds.maximum}`

const expandSeeds = (patterns: Array<string>, range: string) => {
  const [min, max, ...rest] = range.split('..').map(parseSeed)
  if (min === undefined || max === undefined || max < min || rest.length) {
    throw new Error(`--seed-range expects min..max between 0 and ${maximumSeed}.`)
  }
  const seeds = new Set<number>
  for (const pattern of patterns) {
    const matches = new Set<number>
    const matcher = new Minimatch(pattern)
    if (!matcher.negate) {
      for (const part of matcher.globSet) {
        const seed = parseSeed(part)
        if (seed !== undefined) {
          matches.add(seed)
        }
      }
    }
    if (matcher.negate || matcher.globSet.some(part => parseSeed(part) === undefined)) {
      for (let candidate = min; candidate <= max; candidate++) {
        if (matcher.match(String(candidate))) {
          matches.add(candidate)
        }
      }
    }
    if (!matches.size) {
      throw new Error(`--seed “${pattern}” matched no seeds (wildcards search ${range}).`)
    }
    for (const seed of [...matches].toSorted((a, b) => a - b)) {
      seeds.add(seed)
    }
  }
  return [...seeds].map(String)
}
const expandTargets = async (patterns: Array<string>, cwd: string) => {
  // Explicit paths keep their CLI order. Give globby the whole pattern list so its exclusions apply across arguments.
  const paths = patterns.map(pattern => pattern.replaceAll(sep, '/'))
  const dynamic = isDynamicPattern(paths)
  const matches = dynamic ? await globby(paths, {
    cwd,
    onlyDirectories: true,
    expandDirectories: false,
  }) : paths
  const builds = new Set<string>
  for (const directory of dynamic ? matches.toSorted() : matches) {
    const target = resolve(cwd, directory)
    if (directory && await Bun.file(join(target, 'index.html')).exists()) {
      builds.add(target)
    } else if (!dynamic) {
      throw new Error(`--target “${directory}” has no index.html.`)
    }
  }
  if (!builds.size) {
    throw new Error(`--target matched no build folders containing index.html: ${patterns.join(', ')}.`)
  }
  return [...builds]
}

/** One take per target × seed pair, or the usual single take against the dev server with seed 1. */
export const filmInputs = async (options: {
  seed?: Arrayable<string>
  'seed-range'?: string
  target?: Arrayable<string>
}, cwd = process.cwd()) => {
  const builds = options.target === undefined ? [undefined] : await expandTargets([options.target].flat(), cwd)
  const numbers = expandSeeds([options.seed ?? '1'].flat(), options['seed-range'] ?? defaultSeedRange)
  return builds.flatMap(target => numbers.map(seed => ({
    target,
    seed,
  })))
}

export const describeInput = ({seed, target}: Awaited<ReturnType<typeof filmInputs>>[number]) => `${target ?? 'dev server'}, seed ${seed}`
