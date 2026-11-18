import type {OutputList} from '../../src/lib/vite/outputListPlugin.ts'
import type {WorldInfo} from '../../src/worlds/index.ts'

import {join, relative} from 'node:path'

import {knots} from 'knot-materials'

import {hashedFileName, immutableExtensions} from '../../src/lib/vite/immutableHeadersPlugin.ts'
import {outputListFile} from '../../src/lib/vite/outputListPlugin.ts'
import artworks from '../../src/worlds/gallery/artworks.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import {worldIds, worlds} from '../../src/worlds/index.ts'

// Verifies the production build in dist (bun run build first): one page for every world, with each world, each room of the gallery, every Knot material and the Knots’ announcements in chunks of their own that only load on demand, and the game’s chunks and assets named by their content.
// Files are named by their content hash, so the chunks and assets are looked up in the output list the build writes next to it.
const directory = 'dist'
const root = join(import.meta.dir, '..', '..')
const everyFileGlob = new Bun.Glob('**/*')
const scanned = await Array.fromAsync(everyFileGlob.scan(directory))
const files = scanned.map(file => file.replaceAll('\\', '/'))
const {chunks, assets} = await Bun.file(join(root, outputListFile)).json() as OutputList
const fail = (message: string): never => {
  throw new Error(message)
}
/** the repository-relative path of a source file, as the output list names modules */
const fromRoot = (file: string) => relative(root, file).replaceAll('\\', '/')
if (files.some(file => file.endsWith('.map'))) {
  fail('A production source map escaped into the build.')
}
const listed = new Set([...chunks, ...assets].map(output => output.fileName))
const unlisted = files.find(file => !listed.has(file))
if (unlisted) {
  fail(`${unlisted} is not in the output list, which is older than the build.`)
}
// Hashes are case-sensitive, so on a case-insensitive file system two of them can name the same file, which keeps only one.
const lost = [...listed].find(file => !files.includes(file))
if (lost) {
  fail(`${lost} is in the output list but not in the build, like when another file’s hash differs from its hash only in case.`)
}
// The page, social card, crawler policy and headers keep their names.
const named = files.filter(file => !hashedFileName.test(file))
const unexpected = named.find(file => !['_headers', 'index.html', 'preview.jpg', 'robots.txt'].includes(file))
if (unexpected) {
  fail(`${unexpected} is not named by its content hash.`)
}
const headers = await Bun.file(join(directory, '_headers')).text()
for (const extension of immutableExtensions(files)) {
  if (!headers.includes(`/*.${extension}\n  Cache-Control: public, max-age=31536000, immutable`)) {
    fail(`The headers do not let browsers keep the .${extension} files for good.`)
  }
}
const chunkNamed = (name: string) => chunks.find(chunk => chunk.name === name) ?? fail(`The build is missing the ${name} chunk.`)
const chunkOf = (module: string) => chunks.find(chunk => chunk.facadeModule === module) ?? fail(`The build has no chunk of its own for ${module}.`)
const assetOf = (file: string) => assets.find(asset => asset.originalFileNames.includes(fromRoot(file)))
for (const name of ['main', 'sub', 'react', 'three', 'rapier', 'vendor', 'world-base']) {
  chunkNamed(name)
}
const worldChunks = new Map(worldIds.map(id => [id, chunkOf(`src/worlds/${id}/index.ts`).fileName]))
for (const {id, source, narration} of artworks) {
  for (const file of [source, narration]) {
    if (typeof file === 'string' && !assetOf(file)) {
      fail(`The build is missing the ${id} artwork’s ${fromRoot(file)}.`)
    }
  }
}
const html = await Bun.file(join(directory, 'index.html')).text()
if (html.includes('data:image/')) {
  fail('index.html inlines an image.')
}
for (const id of worldIds) {
  const {title, tagline, wallpaper}: WorldInfo = worlds[id]
  if (!html.includes(JSON.stringify(title)) || !html.includes(JSON.stringify(tagline))) {
    fail(`The loading screen does not know ${title}.`)
  }
  // Bun imports the wallpaper as its file, which the build emits encoded as JXL.
  const wallpaperFile = wallpaper && assetOf(wallpaper)?.fileName
  if (wallpaper && (!wallpaperFile?.endsWith('.jxl') || !html.includes(JSON.stringify(`/${wallpaperFile}`)))) {
    fail(`The loading screen’s wallpaper of ${title} is missing.`)
  }
}
const knotChunks = new Map(knots.map(knot => [chunks.find(chunk => chunk.facadeModule === `packages/knot-materials/src/entries/${knot.id}/Material.ts`)?.fileName ?? fail(`The Knot material ${knot.id} has no chunk of its own.`), knot.id]))
const staticImports = new Map(chunks.map(chunk => [chunk.fileName, chunk.imports]))
/** every chunk the chunk needs before it runs */
const closure = (chunk: string) => {
  const seen = new Set<string>
  const pending = [chunk]
  while (pending.length) {
    const next = pending.pop()!
    if (seen.has(next)) {
      continue
    }
    seen.add(next)
    pending.push(...staticImports.get(next) ?? [])
  }
  return seen
}
const main = chunkNamed('main').fileName
// The loading screen starts the deferred module entries. Also count anything the page loads directly.
const entries = html.matchAll(/<(?:(?:script|template) type="module"[^>]*src|link rel="modulepreload"[^>]*href)="\/([^"]+\.js)"/gu).map(match => match[1]).toArray()
if (!entries.includes(main)) {
  fail('index.html does not run the main chunk.')
}
const initial = new Set(entries.flatMap(entry => [...closure(entry)]))
for (const name of ['knot-catalog', 'knot-shaders']) {
  if (initial.has(chunkNamed(name).fileName)) {
    fail(`The ${name} chunk loads with the page instead of on demand.`)
  }
}
if (chunks.some(chunk => /^data\d*$/u.test(chunk.name))) {
  fail('The Knots’ metadata is split into a chunk per entry.')
}
const worldOf = (chunk: string) => worldIds.find(id => worldChunks.get(id) === chunk)
for (const chunk of initial) {
  if (knotChunks.has(chunk) || worldOf(chunk)) {
    fail(`${knotChunks.get(chunk) ?? worldOf(chunk)} loads with the page instead of on demand.`)
  }
}
const read = (chunk: string) => Bun.file(join(directory, chunk)).text()
const initialSources = await Promise.all([...initial].map(read))
const initialCode = initialSources.join('\n')
// Every announcement goes by its path, like entries/<id> for a Knot’s title, in whichever quotes the minifier picked, template literals included.
const announcementPath = new RegExp(`[\`"']entries/(?:${knots.map(knot => RegExp.escape(knot.id)).join('|')})[\`"']`, 'u')
// Otherwise the checks for where they load would pass on any build.
const everySource = await Promise.all(chunks.map(chunk => read(chunk.fileName)))
if (!everySource.some(code => announcementPath.test(code))) {
  fail('No chunk holds the Knots’ announcements by their paths.')
}
if (announcementPath.test(initialCode)) {
  fail('The Knots’ announcements load with the page.')
}
for (const [id, worldChunk] of worldChunks) {
  const needed = closure(worldChunk)
  // The page waits for its world in the main chunk, so a world importing it would wait for itself.
  if (needed.has(main)) {
    fail(`The ${id} world imports the main chunk, which waits for it to load.`)
  }
  for (const chunk of needed) {
    const other = worldOf(chunk)
    if (knotChunks.has(chunk) || other && other !== id) {
      fail(`The ${id} world loads ${knotChunks.get(chunk) ?? other} with it.`)
    }
  }
}
// Only a material’s own chunk may hold it, so loading anything else never downloads a material, nor the textures baked for it.
for (const chunk of chunks) {
  if (knotChunks.has(chunk.fileName)) {
    continue
  }
  const leaked = chunk.imports.find(other => knotChunks.has(other))
  if (leaked) {
    fail(`${chunk.facadeModule ?? chunk.name} imports the Knot material chunk of ${knotChunks.get(leaked)}.`)
  }
}
// The Salon’s showcased Knot loads its material once it mounts and its announcements once it first speaks.
const salon = closure(chunkOf('src/rooms/salon/components/SalonRoom/index.tsx').fileName)
if (salon.has(worldChunks.get('knottingham')!)) {
  fail('The Salon loads the Knottingham world with it.')
}
const salonKnot = [...salon].find(other => knotChunks.has(other))
if (salonKnot) {
  fail(`The Salon loads the Knot material of ${knotChunks.get(salonKnot)} with it.`)
}
const salonSources = await Promise.all([...salon].map(read))
if (salonSources.some(code => announcementPath.test(code))) {
  fail('The Salon loads the Knots’ announcements with it.')
}
// Each room of the gallery and what fills the openings between two of them load only once a page with the room in its ?world_reach asks for them: neither the page, the gallery nor its scene hold any of their code, no room loads another and no fill loads a room.
const fillModules = ['src/components/LobbyWindow/index.tsx', 'src/components/LodgeWindow/index.tsx', 'src/rooms/oculus/components/ApseGrilles/index.tsx']
const chunkHolding = (module: string) => chunks.find(chunk => chunk.modules.includes(module)) ?? fail(`No chunk holds ${module}.`)
/** the chunks holding the code of each room’s components, but for those filling openings */
const roomChunks = new Map(slopGallery.rooms.map(({id}) => [id, new Set(chunks.filter(chunk => chunk.modules.some(module => module.startsWith(`src/rooms/${id}/components/`) && !fillModules.includes(module))).map(chunk => chunk.fileName))]))
const gallery = new Set([...initial, ...closure(worldChunks.get('gallery')!), ...closure(chunkOf('src/components/GalleryScene/index.tsx').fileName)])
for (const [part, held] of [...roomChunks, ...fillModules.map(module => [module, new Set([chunkHolding(module).fileName])] as const)]) {
  if (held.size === 0) {
    fail(`No chunk holds the ${part} room.`)
  }
  if (!held.isDisjointFrom(gallery)) {
    fail(`${part} loads with the gallery instead of on demand.`)
  }
  const needed = new Set(held.values().flatMap(chunk => closure(chunk)))
  const room = roomChunks.entries().find(([id, other]) => id !== part && !other.isDisjointFrom(needed))?.[0]
  if (room) {
    fail(`${part} loads the ${room} room with it.`)
  }
}
console.log(`Verified the build: ${initial.size} chunks load with the page, ${knotChunks.size} Knot materials, ${worldIds.length} worlds and ${roomChunks.size} rooms load on demand, and ${files.length - named.length} of ${files.length} files are named by their content.`)
