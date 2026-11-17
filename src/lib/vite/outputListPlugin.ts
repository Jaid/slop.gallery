import type {Plugin} from 'vite'

import {relative, resolve} from 'node:path'

import fs from 'fs-extra'
import {normalizePath} from 'vite'

/** a chunk of the build, its modules relative to the root */
export type ListedChunk = {
  dynamicImports: ReadonlyArray<string>
  /** the module the chunk exports, if it starts at one */
  facadeModule?: string
  fileName: string
  imports: ReadonlyArray<string>
  isDynamicEntry: boolean
  isEntry: boolean
  /** the modules whose code it holds */
  modules: ReadonlyArray<string>
  name: string
}
/** an asset of the build, its original files relative to the root */
export type ListedAsset = {
  fileName: string
  names: ReadonlyArray<string>
  originalFileNames: ReadonlyArray<string>
}
export type OutputList = {
  assets: ReadonlyArray<ListedAsset>
  chunks: ReadonlyArray<ListedChunk>
}

/** where the production build lists its output, relative to the root */
export const outputListFile = 'out/build/production.json'

/**
 * Writes what the build output and where each file came from to a JSON file outside the output folder, since the files are named by their content hash.
 * Checks of the build look up chunks and assets in it, and it never deploys.
 */
export default function outputListPlugin(file = outputListFile): Plugin {
  let root = process.cwd()
  return {
    name: 'output-list',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    async writeBundle(_options, bundle) {
      const fromRoot = (id: string) => normalizePath(relative(root, id))
      const list: OutputList = {
        chunks: Object.values(bundle).filter(output => output.type === 'chunk').map(chunk => ({
          fileName: chunk.fileName,
          name: chunk.name,
          ...chunk.facadeModuleId ? {facadeModule: fromRoot(chunk.facadeModuleId)} : {},
          isEntry: chunk.isEntry,
          isDynamicEntry: chunk.isDynamicEntry,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          // Virtual modules have no file.
          modules: chunk.moduleIds.filter(id => !id.startsWith('\0')).map(fromRoot),
        })),
        assets: Object.values(bundle).filter(output => output.type === 'asset').map(asset => ({
          fileName: asset.fileName,
          names: asset.names,
          originalFileNames: asset.originalFileNames,
        })),
      }
      await fs.outputJson(resolve(root, file), list, {spaces: 2})
    },
  }
}
