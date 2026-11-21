import type {Edit} from './imports.ts'
import type {JxlEncoding} from './JxlEncoder.ts'
import type {FilterPattern, Plugin, ResolvedConfig} from 'vite'

import {parse as parsePath, relative, resolve} from 'node:path'

import fs from 'fs-extra'
import {createFilter, normalizePath, parse} from 'vite'

import {applyEdits, findImports} from './imports.ts'
import JxlEncoder from './JxlEncoder.ts'

export type {JxlEncoderOptions, JxlEncoding} from './JxlEncoder.ts'
export {getTargetSize, default as JxlEncoder} from './JxlEncoder.ts'

export type JxlPluginOptions = {
  /** cjxl’s executable, `cjxl` from the PATH by default */
  cjxlPath?: string
  /** the distance of imports without a `distance` attribute, 1 by default */
  distance?: number
  /** cjxl’s effort, from 1 to 11, 10 by default */
  effort?: number
  /** where encoded images are cached, relative to the Vite root, `temp/vite-plugin-jxl` by default */
  folder?: string
  /** image files whose imports become JXL even without `format: 'jxl'`, none by default */
  include?: FilterPattern
  /** ImageMagick’s executable, `magick` from the PATH by default */
  magickPath?: string
  /** the longest side of imports without a `maximumLong` attribute, unlimited by default */
  maximumLong?: number
  /** the pixel count of imports without a `maximumPixels` attribute, unlimited by default */
  maximumPixels?: number
}

/** the import attributes the plugin reads */
export type JxlImportAttributes = {
  /** Butteraugli distance, from 0 (lossless) to 25 */
  distance?: `${number}`
  format?: 'jxl'
  /** the length in pixels the longer side is scaled down to if it is longer */
  maximumLong?: `${number}`
  /** the number of pixels the image is scaled down to if it has more, keeping its aspect ratio */
  maximumPixels?: `${number}`
}

export const virtualJxlPrefix = 'virtual:jxl?'
const resolvedVirtualJxlPrefix = `\0${virtualJxlPrefix}`
const attributeNames = new Set(['distance', 'format', 'maximumLong', 'maximumPixels'])
const scriptPattern = /\.[cm]?[jt]sx?(?:\?|$)/u
// Everything ImageMagick reads that an import of an image could name.
const imagePattern = /\.(?:apng|avif|bmp|gif|heic|heif|jfif|jpe?g|jxl|png|psd|qoi|tga|tiff?|webp)$/iu
const cleanUrl = (url: string) => url.replace(/[#?].*$/su, '')
const parseDistance = (value: string | undefined, fallback: number) => {
  const distance = value === undefined ? fallback : Number(value)
  if (value !== undefined && !/^\d+(?:\.\d+)?$/u.test(value) || !Number.isFinite(distance) || distance < 0 || distance > 25) {
    throw new Error(`The distance must be a number from 0 to 25, not ${JSON.stringify(value ?? fallback)}.`)
  }
  return distance
}
const parseLimit = (name: string, value: string | undefined, fallback: number | undefined) => {
  if (value === undefined) {
    return fallback
  }
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new Error(`The attribute ${name} must be a whole number of pixels, not ${JSON.stringify(value)}.`)
  }
  return Number(value)
}

/**
 * Encodes imported images as JXL with ImageMagick and cjxl, at build time, and makes the import the URL of the encoded image.
 *
 * Only imports that ask for it with `format: 'jxl'` change, unless {@link JxlPluginOptions.include} names more:
 *
 * ```ts
 * import wallpaper from './wallpaper.png' with {format: 'jxl', maximumLong: '3840', distance: '3'}
 * ```
 */
export default function jxlPlugin(options: JxlPluginOptions = {}): Plugin {
  const effort = options.effort ?? 10
  if (!Number.isInteger(effort) || effort < 1 || effort > 11) {
    throw new Error(`The effort must be a whole number from 1 to 11, not ${effort}.`)
  }
  const defaultDistance = parseDistance(undefined, options.distance ?? 1)
  for (const name of ['maximumLong', 'maximumPixels'] as const) {
    const limit = options[name]
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw new Error(`The ${name} option must be a whole number of pixels, not ${limit}.`)
    }
  }
  const isIncluded = options.include ? createFilter(options.include) : undefined
  let config: ResolvedConfig
  let encoder: JxlEncoder
  return {
    name: 'jxl',
    enforce: 'pre',
    configResolved(resolved) {
      config = resolved
      encoder = new JxlEncoder({
        folder: resolve(config.root, options.folder ?? 'temp/vite-plugin-jxl'),
        cjxlPath: options.cjxlPath,
        magickPath: options.magickPath,
      })
    },
    transform: {
      filter: {
        id: scriptPattern,
        // Without include, only modules that write out format: 'jxl' have anything to change.
        ...isIncluded ? {} : {code: 'jxl'},
      },
      async handler(code, id) {
        const {program, errors} = await parse(cleanUrl(id), code)
        // Vite reports syntax errors itself.
        if (errors.length) {
          return
        }
        const imports = findImports(code, program, isIncluded ? source => imagePattern.test(cleanUrl(source)) : undefined)
        const edits = await Promise.all(imports.map(async (moduleImport): Promise<Edit | undefined> => {
          const {attributes, source} = moduleImport
          if (attributes.format !== undefined && attributes.format !== 'jxl') {
            return
          }
          if (attributes.format === undefined && !isIncluded) {
            return
          }
          const resolved = await this.resolve(source, id)
          if (!resolved || resolved.external) {
            this.error(`Could not resolve ${source}, which ${id} imports as JXL.`)
          }
          if (attributes.format === undefined && !isIncluded!(resolved.id)) {
            return
          }
          if (/[\0#?]/u.test(resolved.id)) {
            this.error(`The JXL import ${source} in ${id} has to name an image file without a query, not ${resolved.id}.`)
          }
          const unknown = Object.keys(attributes).find(name => !attributeNames.has(name))
          if (unknown) {
            this.error(`The JXL import ${source} in ${id} has the unknown attribute ${unknown}; it only takes ${[...attributeNames].join(', ')}.`)
          }
          const {distance, maximumLong, maximumPixels} = (() => {
            try {
              return {
                distance: parseDistance(attributes.distance, defaultDistance),
                maximumLong: parseLimit('maximumLong', attributes.maximumLong, options.maximumLong),
                maximumPixels: parseLimit('maximumPixels', attributes.maximumPixels, options.maximumPixels),
              }
            } catch (error) {
              this.error(`The JXL import ${source} in ${id} is invalid: ${Error.isError(error) ? error.message : String(error)}`)
            }
          })()
          const query = new URLSearchParams({
            file: normalizePath(resolved.id),
            distance: String(distance),
            ...maximumLong === undefined ? {} : {maximumLong: String(maximumLong)},
            ...maximumPixels === undefined ? {} : {maximumPixels: String(maximumPixels)},
          })
          return {
            start: moduleImport.start,
            end: moduleImport.end,
            text: JSON.stringify(`${virtualJxlPrefix}${query}`),
          }
        }))
        const applicable = edits.filter(edit => edit !== undefined)
        if (!applicable.length) {
          return
        }
        return {
          code: applyEdits(code, applicable),
          map: null,
        }
      },
    },
    resolveId: {
      filter: {
        id: new RegExp(`^${RegExp.escape(virtualJxlPrefix)}`, 'u'),
      },
      handler(source) {
        return `\0${source}`
      },
    },
    load: {
      filter: {
        id: new RegExp(`^${RegExp.escape(resolvedVirtualJxlPrefix)}`, 'u'),
      },
      async handler(id) {
        const query = new URLSearchParams(id.slice(resolvedVirtualJxlPrefix.length))
        const file = query.get('file')
        if (!file) {
          this.error(`The JXL module ${id} names no file.`)
        }
        const maximumLong = query.get('maximumLong')
        const maximumPixels = query.get('maximumPixels')
        const encoding: JxlEncoding = {
          distance: Number(query.get('distance')),
          effort,
          ...maximumLong ? {maximumLong: Number(maximumLong)} : {},
          ...maximumPixels ? {maximumPixels: Number(maximumPixels)} : {},
        }
        this.addWatchFile(file)
        const output = await encoder.encode(file, encoding)
        if (config.command !== 'build') {
          return `export {default} from ${JSON.stringify(`${normalizePath(output)}?url`)}`
        }
        // Emitted under the source’s name, so that the build names it like the image it comes from and lists the source as its original file.
        const referenceId = this.emitFile({
          type: 'asset',
          name: `${parsePath(file).name}.jxl`,
          originalFileName: normalizePath(relative(config.root, file)),
          source: await fs.readFile(output),
        })
        return `export default import.meta.ROLLDOWN_FILE_URL_${referenceId}`
      },
    },
  }
}
