import type {GalleryValues} from './headlessGallery.ts'
import type {ToolCall} from 'capture-page'

import {dirname, resolve} from 'node:path'

import {isPlainObject} from 'es-toolkit'

import {galleryOptions, normalizeOptions, resolveGallerySetup} from './headlessGallery.ts'

export type BenchmarkSetup = {
  /** Overrides the shared gallery options. Additional keys go to the target build as URL parameters. */
  parameters?: Parameters
  target?: false | string
  tools?: ReadonlyArray<Preparation>
}
type Parameters = Record<string, boolean | number | string> & {
  swiftshader?: boolean
  target?: never
}
type Preparation = ToolCall & {
  /** Wait for the navigation this call triggers, like a change to the Studio’s width. */
  reload?: boolean
}

const isPreparation = (value: unknown): value is Preparation => isPlainObject(value)
  && Object.keys(value).every(key => ['input', 'name', 'reload'].includes(key))
  && typeof value.name === 'string' && Boolean(value.name.trim())
  && (value.input === undefined || isPlainObject(value.input))
  && (value.reload === undefined || typeof value.reload === 'boolean')
const areParameters = (value: unknown): value is Parameters => isPlainObject(value)
  && !Object.hasOwn(value, 'target')
  && (value.swiftshader === undefined || typeof value.swiftshader === 'boolean')
  && Object.values(value).every(entry => typeof entry === 'string' || typeof entry === 'boolean' || Number.isFinite(entry))
const readSetup = async (input: BenchmarkSetup | string): Promise<BenchmarkSetup> => {
  let value: unknown = input
  let file: string | undefined
  if (typeof input === 'string') {
    if (input.trimStart().startsWith('{')) {
      value = JSON.parse(input)
    } else if (input.toLowerCase().endsWith('.json')) {
      file = input
      value = await Bun.file(file).json()
    } else {
      value = {target: input}
    }
  }
  if (!isPlainObject(value) || Object.keys(value).some(key => !['parameters', 'target', 'tools'].includes(key))) {
    throw new Error('A benchmark setup takes {target, parameters, tools}, all optional.')
  }
  const {target, parameters, tools}: Record<string, unknown> = value
  if (target !== undefined && target !== false && !(typeof target === 'string' && target.trim())) {
    throw new Error('target must name a build directory or be false for the dev server.')
  }
  if (parameters !== undefined && !areParameters(parameters)) {
    throw new Error('parameters takes gallery options as strings, numbers or booleans; swiftshader is a boolean and target goes on the setup itself.')
  }
  if (tools !== undefined && !(Array.isArray(tools) && tools.every(isPreparation))) {
    throw new Error('tools must be an ordered array of {name, input?, reload?} WebMCP calls.')
  }
  return {
    target: file && typeof target === 'string' && target !== 'false' ? resolve(dirname(file), target) : target,
    parameters,
    tools,
  }
}

/** Resolves one side independently, including parameters only its target build knows. */
export async function resolveBenchmarkSetup(input: BenchmarkSetup | string, shared: GalleryValues, defaultHeight: number) {
  const {target, parameters = {}, tools = []} = await readSetup(input)
  const gallery = await resolveGallerySetup({
    ...shared,
    ...normalizeOptions<GalleryValues>(parameters, galleryOptions),
    target: target === undefined ? shared.target : String(target),
  }, defaultHeight)
  for (const [key, value] of Object.entries(parameters)) {
    if (!Object.hasOwn(galleryOptions, key)) {
      gallery.search.set(key, String(value))
    }
  }
  return {
    ...gallery,
    tools,
  }
}
