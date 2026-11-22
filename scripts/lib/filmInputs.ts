import type {Arrayable} from 'type-fest'

import {join, resolve, sep} from 'node:path'

import {globby, isDynamicPattern} from 'globby'
import {maximumSeed} from 'make-seed'
import {Minimatch} from 'minimatch'

import {coerceEnvironmentSeed, parseSeed} from '#src/lib/environmentSeed.ts'

import {defaultTarget} from './headlessGallery.ts'

export const defaultSeedRange = `0..${maximumSeed}`

const expandSeeds = (patterns: Array<string>, range: string) => {
  const [min, max, ...rest] = range.split('..').map(parseSeed)
  if (min === undefined || max === undefined || max < min || rest.length) {
    throw new Error(`--seed-range expects min..max between 0 and ${maximumSeed}.`)
  }
  // Each argument plays its matches once, sorted; an argument given again plays again.
  const seeds: Array<number> = []
  for (const pattern of patterns) {
    const matches = new Set<number>
    const matcher = new Minimatch(pattern)
    let searchRange = matcher.negate
    for (const part of matcher.globSet) {
      if (isDynamicPattern(part)) {
        searchRange = true
      } else if (!matcher.negate) {
        const seed = coerceEnvironmentSeed(part)
        if (seed !== undefined) {
          matches.add(seed)
        }
      }
    }
    if (searchRange) {
      for (let candidate = min; candidate <= max; candidate++) {
        if (matcher.match(String(candidate))) {
          matches.add(candidate)
        }
      }
    }
    if (!matches.size) {
      throw new Error(`--seed “${pattern}” matched no seeds (wildcards search ${range}).`)
    }
    seeds.push(...[...matches].toSorted((a, b) => a - b))
  }
  return seeds.map(String)
}
/** The builds the patterns name, undefined for the dev server where one is false. */
const expandTargets = async (patterns: Array<string>, cwd: string): Promise<Array<string | undefined>> => {
  // Explicit paths keep their CLI order, repeats included. Give globby the whole pattern list so its exclusions apply across arguments; it returns every match once.
  const paths = patterns.map(pattern => pattern.replaceAll(sep, '/'))
  const dynamic = isDynamicPattern(paths)
  if (paths.includes('false')) {
    if (dynamic) {
      throw new Error('--target false plays the dev server among build folders, not among patterns, whose matches have no place in the order.')
    }
    return Promise.all(paths.map(path => (path === 'false' ? undefined : expandTargets([path], cwd).then(([build]) => build))))
  }
  const matches = dynamic ? await globby(paths, {
    cwd,
    onlyDirectories: true,
    expandDirectories: false,
  }) : paths
  const builds: Array<string> = []
  for (const directory of dynamic ? matches.toSorted() : matches) {
    const target = resolve(cwd, directory)
    if (directory && await Bun.file(join(target, 'index.html')).exists()) {
      builds.push(target)
    } else if (!dynamic) {
      throw new Error(`--target “${directory}” has no index.html.`)
    }
  }
  if (!builds.length) {
    throw new Error(`--target matched no build folders containing index.html: ${patterns.join(', ')}.`)
  }
  return builds
}

/** the seed of a film without --seed: the default environment */
export const defaultFilmSeed = '0'

/** One take per target × seed pair, by default a single take of the default build with the default environment; a target of false is the dev server. */
export const filmInputs = async (options: {
  seed?: Arrayable<string>
  'seed-range'?: string
  target?: Arrayable<string>
}, cwd = process.cwd()) => {
  const builds = await expandTargets([options.target ?? defaultTarget].flat(), cwd)
  const numbers = expandSeeds([options.seed ?? defaultFilmSeed].flat(), options['seed-range'] ?? defaultSeedRange)
  return builds.flatMap(target => numbers.map(seed => ({
    target,
    seed,
  })))
}

export const describeInput = ({seed, target}: Awaited<ReturnType<typeof filmInputs>>[number]) => `${target ?? 'dev server'}, seed ${seed}`
