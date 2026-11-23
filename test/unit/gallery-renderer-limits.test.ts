import {afterEach, expect, test} from 'bun:test'

import {GalleryRenderer} from '../../src/lib/rendering/GalleryRenderer.ts'

type Internals = {
  backend: {
    device?: {limits: Partial<GPUSupportedLimits>}
    parameters: {requiredLimits: Record<string, number>}
  }
  requestLimits: () => Promise<void>
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
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: {requestAdapter: async () => ({limits})},
  })
}
test('the renderer asks for the color attachment limit screen-space reflections need, but never more than the adapter offers', async () => {
  for (const [offered, requested] of [[128, 64], [64, 64], [32, 32]]) {
    offer({
      maxColorAttachmentBytesPerSample: offered,
      maxSampledTexturesPerShaderStage: 16,
    })
    const internals = internalsOf(createRenderer())
    await internals.requestLimits()
    const {requiredLimits} = internals.backend.parameters
    expect(requiredLimits.maxColorAttachmentBytesPerSample, `offered ${offered}`).toBe(requested)
    // Only cinematic pages raise the sampled textures.
    expect(requiredLimits.maxSampledTexturesPerShaderStage).toBeUndefined()
  }
})
test('screen-space reflections need a device with the wider color attachments', () => {
  const renderer = createRenderer()
  expect(renderer.hasWideColorAttachments).toBe(false)
  for (const [limit, wide] of [[32, false], [64, true], [128, true]] as const) {
    internalsOf(renderer).backend.device = {limits: {maxColorAttachmentBytesPerSample: limit}}
    expect(renderer.hasWideColorAttachments, `limit ${limit}`).toBe(wide)
  }
})
