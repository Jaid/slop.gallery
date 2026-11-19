import type {KnotId, PlaceholderShading} from '../src/types.ts'

import {describe, expect, test} from 'bun:test'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import fs from 'fs-extra'

import {entries, KnotCandidate, knotCandidates, knots, knotsById} from '../src/main.ts'
import rarities from '../src/rarities.ts'

const root = fileURLToPath(new URL('../src', import.meta.url))
const placeholderShadings = {
  fabric: true,
  ghost: true,
  glass: true,
  liquid: true,
  metal: true,
  smooth: true,
  stone: true,
} satisfies Record<PlaceholderShading, true>
const source = (file: string) => fs.readFile(resolve(root, file), 'utf8')
const tsFiles = async () => {
  const tsFileGlob = new Bun.Glob('**/*.ts')
  return Array.fromAsync(tsFileGlob.scan(root))
}
describe('flat knot catalogue', () => {
  test('entry folders, metadata exports and rarity keys have exactly the same globally unique IDs', async () => {
    const entryDirectoryEntries = await fs.readdir(resolve(root, 'entries'), {withFileTypes: true})
    const folders = entryDirectoryEntries.filter(entry => entry.isDirectory()).map(entry => entry.name).toSorted()
    const ids = knots.map(entry => entry.id).toSorted()
    expect(ids).toEqual(folders)
    expect(ids).toEqual(Object.keys(entries).toSorted())
    expect(ids).toEqual(Object.keys(rarities).toSorted())
    expect(knotsById.size).toBe(ids.length)
    expect(knotCandidates.flatMap(candidate => candidate.items)).toHaveLength(ids.length)
    const candidateIds = new Set(knotCandidates.map(candidate => candidate.data.id))
    expect(candidateIds.size).toBe(knotCandidates.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][0-9_a-z]*$/u)
      const entryFileGlob = new Bun.Glob('**/*.ts')
      const entryFiles = await Array.fromAsync(entryFileGlob.scan(resolve(root, 'entries', id)))
      expect(entryFiles.toSorted()).toEqual(['Material.ts', 'data.ts'])
      expect(knotsById.get(id)!.id).toBe(id)
    }
  })
  test('every entry has distinctive flavor text, typed placeholder metadata and preserved provenance', () => {
    const flavors = new Set<string>
    for (const entry of knots) {
      const data = entries[entry.id as KnotId]
      expect(entry.candidateId).toBe(data.candidateId)
      expect(entry.candidate.id).toBe(entry.candidateId)
      expect(Number.isSafeInteger(entry.createdAt)).toBe(true)
      expect(entry.createdAt).toBeGreaterThan(0)
      expect(entry.createdAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000))
      expect(entry.flavorText.trim().length).toBeGreaterThan(30)
      expect(entry.flavorText.trim()).toBe(entry.flavorText)
      expect(flavors.has(entry.flavorText)).toBe(false)
      flavors.add(entry.flavorText)
      expect(entry.placeholder.color).toMatch(/^#[\da-f]{6}$/iu)
      expect(Object.hasOwn(placeholderShadings, entry.placeholder.shading)).toBe(true)
      expect(entry.author.model.title.trim().length).toBeGreaterThan(0)
      expect('rarity' in data, entry.id).toBe(false)
    }
  })
  test('the metadata entry point bundles without importing shaders or Three.js', async () => {
    const result = await Bun.build({
      entrypoints: [resolve(root, 'main.ts')],
      target: 'browser',
    })
    expect(result.success).toBe(true)
    const outputTexts = await Promise.all(result.outputs.map(file => file.text()))
    const output = outputTexts.join('\n')
    expect(output).not.toContain('MeshPhysicalNodeMaterial')
    expect(output).not.toContain('three/tsl')
    expect(output).not.toContain('/Material.ts')
    expect(output).toContain('chladni_resonance')
  })
  test('the package has no imports into the application and shader helpers obey their ownership scopes', async () => {
    for (const file of await tsFiles()) {
      const normalized = file.replaceAll('\\', '/')
      const text = await source(file)
      expect(text).not.toContain('#src/')
      const fullPath = resolve(root, file)
      for (const match of text.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu)) {
        if (!match[1].startsWith('.')) {
          continue
        }
        const dependency = resolve(dirname(fullPath), match[1])
        expect(dependency.startsWith(`${root}\\`) || dependency.startsWith(`${root}/`), `${file}: ${match[1]}`).toBe(true)
        if (normalized.startsWith('lib/')) {
          expect(dependency.replaceAll('\\', '/')).not.toContain('/src/entries/')
          expect(dependency.replaceAll('\\', '/')).not.toContain('/src/candidates/')
        }
        const entryId = /^entries\/([^/]+)\//u.exec(normalized)?.[1]
        if (!entryId) {
          continue
        }
        const helperCandidate = /\/candidates\/([^/]+)\/lib\//u.exec(dependency.replaceAll('\\', '/'))?.[1]
        if (helperCandidate) {
          expect(helperCandidate).toBe(knotsById.get(entryId)!.candidateId)
        }
      }
    }
  })
})
test('missing rarity cannot be satisfied by an inherited object property', () => {
  const original = knots[0]
  for (const id of ['missing_entry', 'constructor']) {
    expect(() => new KnotCandidate(original.candidate, [{
      ...original,
      id,
    }])).toThrow('Missing Knot rarity')
  }
})
