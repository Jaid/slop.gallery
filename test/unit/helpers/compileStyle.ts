import {resolve} from 'node:path'

import {preprocessCSS, resolveConfig} from 'vite'

const root = resolve(import.meta.dir, '../../..')
let config: ReturnType<typeof resolveConfig> | undefined

export default async function compileStyle(file: string) {
  const path = resolve(root, file)
  config ??= resolveConfig({
    root,
    configLoader: 'native',
    logLevel: 'silent',
  }, 'serve')
  return preprocessCSS(await Bun.file(path).text(), path, await config)
}
