import type {KnotEntry} from '../src/types.ts'
import type {RenderFrame} from './lib/renderSettings.ts'

import {join, resolve} from 'node:path'
import {parseArgs} from 'node:util'

import fs from 'fs-extra'

import {knotsById} from '../src/main.ts'
import {encodeAnimatedJxl, encodeWebm} from './lib/encodeAnimation.ts'
import {encodeJxl} from './lib/encodeJxl.ts'
import {angleAnimationFrame, angleNames, angleStillFrame, animationFilename, animationFrames, closeupStillFrame, distanceNames, distanceStillFrame, inspectionAnimatedJxlDistance, inspectionAnimationFrame, inspectionAnimationFrames, inspectionVideoSize} from './lib/renderSettings.ts'
import withPreviewRenderer from './lib/withPreviewRenderer.ts'

export const renderCategories = ['snapshot', 'animation', 'video'] as const
export type RenderCategory = typeof renderCategories[number]
/** renders one frame of the knot and resolves with it as PNG bytes */
export type KnotFrameRenderer = (frame: RenderFrame) => Promise<Uint8Array>
/** prepares a knot for rendering, hands `run` its frame renderer and releases everything once `run` settles */
export type KnotScene = (item: KnotEntry, run: (render: KnotFrameRenderer) => Promise<void>) => Promise<void>
export type NamedKnotScene = {
  /** one line for --help */
  description: string
  scene: KnotScene
}
export type RenderKnotOptions = {
  categories?: ReadonlyArray<RenderCategory>
  /** folder in out/render that receives the renders. Default: the knot ID */
  folder?: string
  onFile?: (filename: string) => void
  /** Default: the knot alone on a transparent background in its own studio */
  scene?: KnotScene
}

const renderCategorySet = new Set<string>(renderCategories)
const renderRoot = resolve(import.meta.dir, '../out/render')
const getKnot = (id: string) => {
  const item = knotsById.get(id)
  if (!item) {
    throw new Error(`Unknown Knot ID: ${id}`)
  }
  return item
}
const removeRenderedImage = async (directory: string, stem: string) => fs.remove(join(directory, `${stem}.jxl`))
const writeStill = async (image: Uint8Array, directory: string, stem: string) => {
  const filename = `${stem}.jxl`
  const output = join(directory, filename)
  const input = `${output}.png`
  await fs.writeFile(input, image)
  try {
    await encodeJxl(input, output)
  } finally {
    await fs.remove(input)
  }
  return filename
}

export const parseRenderCategories = (value = renderCategories.join(',')): Array<RenderCategory> => {
  const requested = value.split(',').map(category => category.trim())
  if (requested.some(category => !category || !renderCategorySet.has(category))) {
    throw new Error(`Render category must be a comma-separated combination of: ${renderCategories.join(', ')}.`)
  }
  return [...new Set(requested)] as Array<RenderCategory>
}

/** The knot alone on a transparent background, lit by its own studio, in a detached renderer of a private headless browser. */
export const transparentScene: KnotScene = (item, run) => withPreviewRenderer(async renderer => {
  const preview = await renderer.evaluateHandle((instance, entry) => instance.createPreview(entry), item)
  try {
    await run(async frame => Uint8Array.fromBase64(await preview.evaluate((instance, value) => instance.renderFrame(value), frame)))
  } finally {
    try {
      await preview.evaluate(instance => instance.dispose())
    } finally {
      await preview.dispose()
    }
  }
})

export default async function renderKnot(id: string, {categories = renderCategories, folder = id, onFile, scene = transparentScene}: RenderKnotOptions = {}) {
  const item = getKnot(id)
  const selected = new Set(categories)
  if (selected.size === 0) {
    throw new Error('Select at least one render category.')
  }
  await fs.ensureDir(renderRoot)
  const staging = await fs.mkdtemp(join(renderRoot, `.${folder}-`))
  const destination = join(renderRoot, folder)
  try {
    if (selected.size < renderCategories.length && await fs.pathExists(destination)) {
      await fs.copy(destination, staging)
    }
    await scene(item, async renderFrame => {
      if (selected.has('snapshot')) {
        for (const name of angleNames) {
          await removeRenderedImage(staging, `angle_${name}`)
        }
        for (const name of distanceNames) {
          await removeRenderedImage(staging, `distance_${name}`)
        }
        await removeRenderedImage(staging, 'closeup')
        for (const [index, name] of angleNames.entries()) {
          const image = await renderFrame(angleStillFrame(index))
          const filename = await writeStill(image, staging, `angle_${name}`)
          onFile?.(filename)
        }
        for (const [index, name] of distanceNames.entries()) {
          const image = await renderFrame(distanceStillFrame(index))
          const filename = await writeStill(image, staging, `distance_${name}`)
          onFile?.(filename)
        }
        const closeup = await renderFrame(closeupStillFrame())
        const closeupFilename = await writeStill(closeup, staging, 'closeup')
        onFile?.(closeupFilename)
      }
      if (selected.has('animation')) {
        await removeRenderedImage(staging, 'angles.animated')
        const angleFrames = join(staging, '.angle-frames')
        await fs.ensureDir(angleFrames)
        for (let index = 0; index < animationFrames; index++) {
          const image = await renderFrame(angleAnimationFrame(index))
          await fs.writeFile(join(angleFrames, animationFilename(index)), image)
        }
        const filename = 'angles.animated.jxl'
        const encoded = await encodeAnimatedJxl(angleFrames, inspectionAnimatedJxlDistance)
        await fs.rename(encoded, join(staging, filename))
        await fs.remove(angleFrames)
        onFile?.(filename)
      }
      if (selected.has('video')) {
        const videoFrames = join(staging, '.animation-frames')
        await fs.ensureDir(videoFrames)
        for (let index = 0; index < inspectionAnimationFrames; index++) {
          const image = await renderFrame(inspectionAnimationFrame(index))
          await fs.writeFile(join(videoFrames, animationFilename(index)), image)
        }
        const filename = 'animation.webm'
        await fs.rename(await encodeWebm(videoFrames, {frameCount: inspectionAnimationFrames}), join(staging, filename))
        await fs.remove(videoFrames)
        onFile?.(filename)
      }
    })
    await fs.remove(destination)
    await fs.rename(staging, destination)
    return destination
  } catch (error) {
    await fs.remove(staging)
    throw error
  }
}

const sceneNamesOf = (scenes: Record<string, NamedKnotScene>) => ['transparent', ...Object.keys(scenes)]
const assertSceneName = (scenes: Record<string, NamedKnotScene>, sceneName: string) => {
  const sceneNames = sceneNamesOf(scenes)
  if (!sceneNames.includes(sceneName)) {
    throw new Error(`--scene must be one of: ${sceneNames.join(', ')}.`)
  }
}

/** folder in out/render that receives the renders of the knot in the scene of that name: <id> for `transparent`, otherwise <id>-<scene> */
export const sceneFolder = (id: string, sceneName = 'transparent') => (sceneName === 'transparent' ? id : `${id}-${sceneName}`)

/** Renders the knot in the scene of that name: `transparent`, the default, or one of `scenes`, into out/render/<id> or out/render/<id>-<scene>. */
export const renderKnotInScene = (id: string, scenes: Record<string, NamedKnotScene>, {scene: sceneName = 'transparent', ...options}: Omit<RenderKnotOptions, 'folder' | 'scene'> & {scene?: string} = {}) => {
  assertSceneName(scenes, sceneName)
  return renderKnot(id, {
    ...options,
    folder: sceneFolder(id, sceneName),
    scene: sceneName === 'transparent' ? undefined : scenes[sceneName].scene,
  })
}

/** --help of renderKnot’s command line, which lists `scenes` besides the default `transparent` */
export const renderKnotHelp = (scenes: Record<string, NamedKnotScene> = {}) => {
  const sceneNames = sceneNamesOf(scenes)
  const sceneHelp = sceneNames.length > 1 ? `\n\nScenes, selected with --scene; default: transparent:\n  transparent  the knot alone on a transparent background, written to out/render/<knot-id>${Object.entries(scenes).map(([name, {description}]) => `\n  ${name.padEnd(11)}  ${description}, written to out/render/<knot-id>-${name}`).join('')}` : ''
  return `Usage: bun scripts/renderKnot.ts <knot-id> [--category snapshot,animation,video]${sceneNames.length > 1 ? ` [--scene ${sceneNames.join('|')}]` : ''}
Categories can be snapshot, animation, video, or any comma-separated combination; default: snapshot,animation,video. Snapshots and the animated angle loop use JPEG XL. Video is ${inspectionVideoSize}x${inspectionVideoSize} AV1/WebM.${sceneHelp}`
}

/** Parses and validates renderKnot’s command line against `scenes` besides the default `transparent`. Resolves nothing for --help. */
export const parseRenderKnotArgs = <Scenes extends Record<string, NamedKnotScene>>(args: Array<string>, scenes = {} as Scenes) => {
  const {values, positionals} = parseArgs({
    args,
    allowPositionals: true,
    options: {
      category: {type: 'string'},
      scene: {type: 'string'},
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    return
  }
  if (positionals.length !== 1) {
    throw new Error('Specify exactly one canonical Knot ID. Use --help for usage.')
  }
  const id = positionals[0]
  getKnot(id)
  const categories = parseRenderCategories(values.category)
  const scene = values.scene ?? 'transparent'
  assertSceneName(scenes, scene)
  return {
    categories,
    id,
    scene: scene as Extract<keyof Scenes, string> | 'transparent',
  }
}

/** Command line of renderKnot. `scenes` adds named scenes to --scene besides the default `transparent`; their renders go to out/render/<id>-<scene>. */
export const renderKnotCli = async (args = Bun.argv.slice(2), scenes: Record<string, NamedKnotScene> = {}) => {
  const parsed = parseRenderKnotArgs(args, scenes)
  if (!parsed) {
    console.log(renderKnotHelp(scenes))
    return
  }
  const {id, ...options} = parsed
  console.log(`Output: out/render/${sceneFolder(id, options.scene)}`)
  await renderKnotInScene(id, scenes, {
    ...options,
    onFile: filename => console.log(filename),
  })
}

if (import.meta.main) {
  await renderKnotCli()
}
