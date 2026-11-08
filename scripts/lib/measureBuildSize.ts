import * as path from 'forward-slash-path'
import fs from 'fs-extra'

export type BuildSize = {
  /** bytes of the files as the build writes them, before any compression the server applies */
  bytes: number
  files: number
}
/** the sizes of the files of every kind, most bytes first */
export type BuildSizes = Record<string, BuildSize>

const everyFileGlob = new Bun.Glob('**/*')

/** a file’s kind: its extension in lowercase, or the name of a file without one, like _headers */
export const fileKind = (file: string) => {
  const name = path.basename(file)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : name
}

/** The files and bytes of the build in `folder` by the kinds of its files, the kinds with the most bytes first. */
export default async function measureBuildSize(folder: string) {
  if (!await fs.pathExists(folder)) {
    throw new Error(`There is no build in ${folder}. Build it first, e.g. bun run build.`)
  }
  const sizes: BuildSizes = {}
  for await (const file of everyFileGlob.scan({
    cwd: folder,
    dot: true,
  })) {
    const kind = fileKind(file)
    sizes[kind] ??= {
      files: 0,
      bytes: 0,
    }
    sizes[kind].files++
    sizes[kind].bytes += Bun.file(path.join(folder, file)).size
  }
  return Object.fromEntries<BuildSize>(Object.entries(sizes).toSorted(([aKind, a], [bKind, b]) => b.bytes - a.bytes || aKind.localeCompare(bKind)))
}
