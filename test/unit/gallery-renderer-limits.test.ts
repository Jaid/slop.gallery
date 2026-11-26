import {afterEach, expect, test} from 'bun:test'

import {GalleryRenderer} from '../../src/lib/rendering/GalleryRenderer.ts'

type Internals = {
  backend: {
    device?: {limits: Partial<GPUSupportedLimits>}
    parameters: {requiredLimits: Record<string, number>}
  }
  requestLimits: (wideColorAttachments?: boolean, cinematic?: boolean) => Promise<void>
  untrackLoading: () => void
}

const renderers: Array<GalleryRenderer> = []
afterEach(() => {
  for (const renderer of renderers.splice(0)) {
    ;(renderer as unknown as Internals).untrackLoading()
  }
  Reflect.deleteProperty(navigator, 'gpu')
})
const createRenderer = () => {
  const renderer = new GalleryRenderer({canvas: {style: {}} as HTMLCanvasElement})
  renderers.push(renderer)
  return renderer
}
const internalsOf = (renderer: GalleryRenderer) => renderer as unknown as Internals
/** an adapter offering these limits through a stub `navigator.gpu` */
const offer = (limits: Partial<GPUSupportedLimits>) => {
  let requests = 0
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: {
      requestAdapter: async () => {
        requests++
        return {limits}
      },
    },
  })
  return () => requests
}
test('fast graphics need no extra limits and skip the extra adapter request', async () => {
  const requests = offer({
    maxColorAttachmentBytesPerSample: 128,
    maxSampledTexturesPerShaderStage: 32,
  })
  const internals = internalsOf(createRenderer())
  await internals.requestLimits()
  expect(requests()).toBe(0)
  expect(internals.backend.parameters.requiredLimits).toEqual({})
})
test('heavy graphics ask for the color attachment limit screen-space reflections need, and cinematic also raises sampled textures, never above what the adapter offers', async () => {
  for (const [offered, requested] of [[128, 64], [64, 64], [32, 32]]) {
    offer({
      maxColorAttachmentBytesPerSample: offered,
      maxSampledTexturesPerShaderStage: 16,
    })
    const internals = internalsOf(createRenderer())
    await internals.requestLimits(true, false)
    const {requiredLimits} = internals.backend.parameters
    expect(requiredLimits.maxColorAttachmentBytesPerSample, `offered ${offered}`).toBe(requested)
    // Only cinematic pages raise the sampled textures.
    expect(requiredLimits.maxSampledTexturesPerShaderStage).toBeUndefined()
  }
  offer({
    maxColorAttachmentBytesPerSample: 128,
    maxSampledTexturesPerShaderStage: 24,
  })
  const cinematic = internalsOf(createRenderer())
  await cinematic.requestLimits(true, true)
  expect(cinematic.backend.parameters.requiredLimits).toEqual({
    maxColorAttachmentBytesPerSample: 64,
    maxSampledTexturesPerShaderStage: 24,
  })
})
test('screen-space reflections need a device with the wider color attachments', () => {
  const renderer = createRenderer()
  expect(renderer.hasWideColorAttachments).toBe(false)
  for (const [limit, wide] of [[32, false], [64, true], [128, true]] as const) {
    internalsOf(renderer).backend.device = {limits: {maxColorAttachmentBytesPerSample: limit}}
    expect(renderer.hasWideColorAttachments, `limit ${limit}`).toBe(wide)
  }
})
