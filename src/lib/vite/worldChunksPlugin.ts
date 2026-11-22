import type {CodeSplittingGroup} from 'rolldown'
import type {Plugin} from 'vite'

import {resolve} from 'node:path'

import {normalizePath} from 'vite'

/**
 * A chunk for what worlds that load on demand behind a top-level await, like `src/worlds/current.ts`, share with the page.
 *
 * The page waits for the world its URL chose before it runs, so a world’s chunks must never import a chunk of the page: that chunk would wait for the world, and the world for it.
 * Rolldown puts a module the page and a world share into the page’s chunks, so this moves whatever a world imports that the page imports too into `world-base`, which the page and every world load.
 * It holds nothing that imports the page’s waiting module, as long as the worlds never import it themselves. Everything else a world imports only loads with it or the other lazy chunks that share it, like always.
 *
 * Add {@link worldChunksPlugin.groups} to the output’s code splitting groups, ahead of any catch-all group of the page, like thematic chunks’ `main`.
 *
 * @param worlds every module the page waits for, by world: its own, and any it awaits itself, like the Sandbox’s rooms’, which a dynamic import loads behind the same wait
 */
export default function worldChunksPlugin(worlds: Readonly<Record<string, ReadonlyArray<string>>>) {
  /** what the page and any of the worlds import statically, all the way down */
  let shared: ReadonlySet<string> = new Set
  let root = process.cwd()
  const groups: Array<CodeSplittingGroup> = [
    {
      name: 'world-base',
      test: id => shared.has(id),
      // Above the page’s own catch-all chunk, below its chunks of packages and libraries, which never import the page’s code.
      priority: 1,
      includeDependenciesRecursively: false,
    },
  ]
  const plugin: Plugin & {groups: ReadonlyArray<CodeSplittingGroup>} = {
    name: 'world-chunks',
    apply: 'build',
    groups,
    configResolved(config) {
      root = config.root
    },
    buildEnd(error) {
      // A failed scan can leave the graph incomplete. Preserve the error that interrupted it.
      if (error) {
        return
      }
      const closure = (from: ReadonlyArray<string>) => {
        const seen = new Set<string>
        const pending = [...from]
        while (pending.length) {
          const id = pending.pop()!
          if (seen.has(id)) {
            continue
          }
          seen.add(id)
          pending.push(...this.getModuleInfo(id)?.importedIds ?? [])
        }
        return seen
      }
      const initial = closure([...this.getModuleIds()].filter(id => this.getModuleInfo(id)?.isEntry))
      const imported = new Set<string>
      for (const [name, files] of Object.entries(worlds)) {
        for (const file of files) {
          const id = normalizePath(resolve(root, file))
          if (!this.getModuleInfo(id)) {
            this.error(`The world ${name} has no module at ${file}.`)
          }
          if (initial.has(id)) {
            this.error(`The page imports the world ${name} statically, so it can’t load on demand.`)
          }
          for (const module of closure([id])) {
            imported.add(module)
          }
        }
      }
      shared = imported.intersection(initial)
    },
  }
  return plugin
}
