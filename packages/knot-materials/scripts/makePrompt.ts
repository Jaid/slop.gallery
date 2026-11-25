import type {KnotEntry} from '../src/types.ts'

import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'

import fs from 'fs-extra'

import {knotCandidates, knots, knotsById} from '../src/main.ts'
import PromptSources from './lib/PromptSources.ts'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

export type PromptOptions = {
  candidate?: string
  count?: number
  exampleIds?: ReadonlyArray<string>
  examples?: number
  seed?: string
}

/** Stable sampling favors different candidates and placeholder families before filling remaining slots. */
export function selectExamples({exampleIds, examples = 3, seed = 'knot-materials'}: Pick<PromptOptions, 'exampleIds' | 'examples' | 'seed'> = {}) {
  if (!Number.isSafeInteger(examples) || examples < 1 || examples > knots.length) {
    throw new Error(`Example count must be an integer between 1 and ${knots.length}.`)
  }
  if (exampleIds) {
    const uniqueExampleIds = new Set(exampleIds)
    if (!exampleIds.length || uniqueExampleIds.size !== exampleIds.length) {
      throw new Error('Example IDs must be nonempty and unique.')
    }
    return exampleIds.map(id => {
      const entry = knotsById.get(id)
      if (!entry) {
        throw new Error(`Unknown example Knot ID: ${id}`)
      }
      return entry
    })
  }
  const score = (entry: KnotEntry) => createHash('sha256').update(`${seed}:${entry.id}`).digest('hex')
  const ordered = knots.map(entry => ({
    entry,
    score: score(entry),
  })).toSorted((a, b) => a.score.localeCompare(b.score)).map(({entry}) => entry)
  const selected: Array<KnotEntry> = []
  for (const entry of ordered) {
    if (selected.some(other => other.candidateId === entry.candidateId || other.placeholder.shading === entry.placeholder.shading)) {
      continue
    }
    selected.push(entry)
    if (selected.length === examples) {
      return selected
    }
  }
  for (const entry of ordered) {
    if (!selected.includes(entry)) {
      selected.push(entry)
    }
    if (selected.length === examples) {
      break
    }
  }
  return selected
}

/** Build an inference-ready Markdown prompt from the current catalogue and actual source files. */
export default async function makePrompt({candidate, count = 8, ...sampling}: PromptOptions = {}) {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error('Knot count must be a positive integer.')
  }
  const author = candidate === undefined ? undefined : knotCandidates.find(entry => entry.data.id === candidate)
  if (candidate !== undefined && !author) {
    throw new Error(`Unknown Knot candidate: ${candidate}`)
  }
  const examples = selectExamples(sampling)
  const context = new PromptSources(packageRoot)
  await context.add('src/types.ts')
  await context.add('src/lib/index.ts')
  const candidateApi = author && `src/candidates/${author.data.id}/lib/index.ts`
  if (candidateApi && await fs.pathExists(resolve(packageRoot, candidateApi))) {
    await context.add(candidateApi)
  }
  const authoringFiles = new Set(context.files.keys())
  const library = context.markdown(authoringFiles)
  for (const entry of examples) {
    await context.add(`src/entries/${entry.id}/data.ts`)
    await context.add(`src/entries/${entry.id}/Material.ts`)
  }
  const exampleFiles = context.files.keys().filter(file => !authoringFiles.has(file)).toArray()
  const exampleSource = context.markdown(exampleFiles)
  const importable = [...authoringFiles].filter(file => file.startsWith('src/lib/') || file.startsWith('src/candidates/')).map(file => `- \`../../${file.slice(4)}\``).join('\n')
  const reserved = knots.map(entry => entry.id).toSorted().join(', ')
  return `# Create ${count} new knot materials

Design exactly ${count} original, gallery-worthy procedural Three.js/WebGPU/TSL knot materials${author ? ` for candidate \`${author.data.id}\` (${author.data.title})` : ''}.

## Deliverables

Return complete, path-labeled TypeScript code blocks for each new \`src/entries/<id>/data.ts\` and \`src/entries/<id>/Material.ts\`. Keep all knot-specific helper functions in the entry's Material.ts; do not create knot-scoped helper or library files. Do not return a batch switch, a wrapper around another entry, or repeated copies of the supplied library.

Each metadata module must be a default object with \`as const satisfies KnotData\` imported from \`../../types.ts\`. Include:

- A globally unique snake_case \`id\`, an evocative \`title\`, and a distinct one- or two-sentence \`flavorText\`.
- \`candidateId: ${author ? `'${author.data.id}'` : "'<candidate ID supplied by the caller>'"}\`, plus accurate \`author.model\` provenance and \`harness\`. Never invent model versions or effort levels; ask the inference caller to fill unknown provenance.
- \`placeholder: {color: hsl.integer(hue, saturation, lightness), shading: 'smooth' | 'ghost' | 'metal' | 'glass' | 'stone' | 'liquid' | 'fabric'}\`. Use \`import hsl from 'okhsl'\` for packed sRGB colors in metadata and materials. Hue is in degrees, saturation and lightness in percent. Choose one shading literal appropriate for that entry.
- A conservative positive \`displacement\` bound in meters whenever vertices move; omit it for undisplaced materials.

Do not add \`accent\`, \`highlighted\`, \`sourceId\`, plate numbers, or a per-entry rarity field. Supply separate export additions for \`src/entries/index.ts\` and additions to \`src/rarities.ts\` using \`unknown\` for new entries; rarity is curated centrally afterward. Existing rarity constants are unknown=0 (no stars), common=1, rare=2, prime=3, ethereal=4, special=5 (never exhibited automatically).

## Creative direction

Explore genuinely different physical ideas, not recolors of one noise graph. Favor readable large-scale structure, rich close-up detail, restrained motion, and a meaningful response to view angle or viewer distance. The sculpture should reward exploration without distracting flashes. Write flavor text about the imagined object, not its implementation or model author.

## Implementation contract

Every \`Material.ts\` exports an anonymous default class extending \`KnotMaterial\` from \`../../lib/KnotMaterial.ts\`. Put the material description in a compact one-line JSDoc immediately above that class, like \`/** my description */\`, not as an inline constructor comment. Its constructor accepts \`environment: Texture\` from \`three/webgpu\`, calls \`super(environment[, intensity])\`, imports \`knotData\` from \`./data.ts\`, and sets \`this.name = knotData.id\`.

Use the installed Three.js TSL APIs demonstrated below, \`three/tsl\`, \`three/webgpu\`, and the supplied library. Prefer direct imports from \`../../lib/<file>.ts\`; \`../../lib/index.ts\` is also available. Shared helpers belong in \`src/lib\`, candidate-only helpers in \`src/candidates/<candidateId>/lib\`, and knot-only helpers stay inside the corresponding Material.ts. Never import the parent application, another knot's material, or an invented package.

The mesh is a torus knot with geometry arguments [0.45, 0.13, 256, 64, 2, 3], including smooth tangents and a caller-owned studio environment. Do not dispose the supplied texture. No downloaded textures, DOM/canvas access, asynchronous constructors, GLSL strings, or external assets are allowed in a material. Keep derivatives in fragment shading; vertex displacement must not use screen-space derivatives. Filter narrow details before thresholding and fade unresolved frequencies. Avoid unnecessary transparent rendering; use physical transmission for glass. Ensure all shader outputs remain finite.

## Reserved global IDs

None of these IDs may be reused, even for a different candidate:

${reserved}

## Importable authoring API and metadata contract

These are the complete sources reachable from the shared shader API and the selected candidate’s shader API, including helpers not used by any sampled example. Unexported utilities, rendering infrastructure, icon scripts, and unrelated candidate APIs are not authoring context. Third-party Three.js implementation sources are not embedded. Catalogue-derived ID types are supplied by the package.

Available shader imports for your own Material.ts:

${importable}

${library}

## Current material examples

The following ${examples.length} examples are sampled from the catalogue. Their candidate-scoped dependencies are included in full; knot-specific helpers are already part of each Material.ts. Treat them as implementation references, not concepts to copy. Helpers belonging to another candidate are example-only; do not import those into a new entry. Use the authoring API above or keep knot-specific logic local to the material.

${exampleSource}
`
}

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      candidate: {type: 'string'},
      count: {type: 'string'},
      examples: {type: 'string'},
      'example-ids': {type: 'string'},
      seed: {type: 'string'},
      output: {
        type: 'string',
        short: 'o',
      },
    },
  })
  if (values.help) {
    console.log('Usage: bun scripts/makePrompt.ts [--candidate ID] [--count 8] [--examples 3] [--example-ids id,id] [--seed text] [--output prompt.md]')
  } else {
    const markdown = await makePrompt({
      candidate: values.candidate,
      count: values.count === undefined ? undefined : Number(values.count),
      examples: values.examples === undefined ? undefined : Number(values.examples),
      exampleIds: values['example-ids']?.split(',').map(id => id.trim()),
      seed: values.seed,
    })
    if (values.output) {
      const destination = resolve(values.output)
      await fs.outputFile(destination, markdown)
    } else {
      process.stdout.write(markdown)
    }
  }
}
