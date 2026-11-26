import type {Plugin, Rolldown} from 'vite'

import {headersFileName} from 'rolldown-plugin-jxl-headers'

/** a file name the build derives from the file’s content: eight characters of Rolldown’s base64url hash and the extension */
export const hashedFileName = /^[\w-]{8}\.[\da-z]+$/iu
const cacheControl = 'public, max-age=31536000, immutable'

/** The extensions of the hashed files, which every file of that extension has to be. */
export function immutableExtensions(fileNames: Iterable<string>) {
  const hashed = new Set<string>
  const named = new Map<string, string>
  for (const fileName of fileNames) {
    const extension = /\.([\da-z]+)$/iu.exec(fileName)?.[1]
    if (!extension) {
      continue
    }
    if (hashedFileName.test(fileName)) {
      hashed.add(extension)
    } else {
      named.set(extension, fileName)
    }
  }
  for (const extension of hashed) {
    const fileName = named.get(extension)
    if (fileName) {
      throw new Error(`${fileName} keeps its name, but every other .${extension} file is named by its content hash, so it would be cached as immutable too.`)
    }
  }
  return [...hashed].toSorted()
}

/**
 * Lets browsers keep every file named by its content hash for good, through the Cloudflare Pages `_headers` file that rolldown-plugin-jxl-headers emits, which it adds to.
 * A changed file gets a new name, so only the page itself, which keeps its name and always revalidates, has to be fetched again after a deploy.
 */
export default function immutableHeadersPlugin(): Plugin {
  return {
    name: 'immutable-headers',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const rules = immutableExtensions(Object.keys(bundle)).map(extension => `/*.${extension}\n  Cache-Control: ${cacheControl}\n`).join('')
        const existing = bundle[headersFileName] as Rolldown.OutputAsset | undefined
        if (existing) {
          existing.source = `${Buffer.from(existing.source).toString()}${rules}`
          return
        }
        this.emitFile({
          type: 'asset',
          fileName: headersFileName,
          source: rules,
        })
      },
    },
  }
}
