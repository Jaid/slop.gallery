import type {ImagePrompt} from '../gallery/fusion/FusionRecipe.ts'
import type {RatioString} from './imageRatios.ts'
import type {OpenRouterAccess} from './openRouterAccess.ts'
import type {AiTier} from './settings.ts'

import {APICallError, generateImage, generateText} from 'ai'

import {requestedRatio} from './imageRatios.ts'
import {modelImageType} from './modelImage.ts'
import SdkGenerator from './SdkGenerator.ts'
import {tieredModel} from './settings.ts'

type EditOptions = {
  /** width divided by height of the hung portrait, which decides the ratio the model is asked for */
  aspect?: number
  signal?: AbortSignal
}

/** the models OpenRouter’s chat endpoint turned away during this session, which only its `/images` endpoint serves */
const imagesOnlyModels = new Set<string>
/** whether `error` is OpenRouter’s refusal to serve an image model through chat, like GPT Image or Flux, which it answers with a 404 pointing to `/images` */
const isImagesOnlyRefusal = (error: unknown) => APICallError.isInstance(error) && error.statusCode === 404 && error.message.includes('/images')
const toBlob = (file: {
  mediaType: string
  uint8Array: Uint8Array
}) => {
  const bytes = new Uint8Array(file.uint8Array)
  return new Blob([bytes.buffer], {type: file.mediaType})
}

/**
 * Makes fusion results through OpenRouter’s chat endpoint wherever the model takes it, and through its `/images` endpoint for models that only serve there, like GPT Image 2.5 Sunburst.
 * The same Nano Banana 2.1 fusion took a median 10.1 s through chat and 17.3 s through `/images`, with the same tokens and image (2026-11-03, 12 rounds each). Chat also takes the `ai_tier` routing variants, which `/images` answers with a 404.
 */
export default class extends SdkGenerator {
  constructor(access: OpenRouterAccess, private readonly modelId: string, private readonly tier?: AiTier) {
    super(access)
  }
  /** Makes the result of a fusion from the prompt its recipe wrote of the images and instructions its ingredients contributed (`FusionRecipe.content`). */
  async generate(prompt: ImagePrompt, {aspect, signal = AbortSignal.timeout(180_000)}: EditOptions = {}) {
    // Without a ratio, a 3:2 portrait fused with a prop’s square photograph came back 4:3 from Nano Banana 2.1 and Grok and square from Sunburst (2026-11-01).
    const ratio = aspect === undefined ? undefined : requestedRatio(this.modelId, aspect)
    if (!imagesOnlyModels.has(this.modelId)) {
      try {
        return await this.chat(prompt, ratio, signal)
      } catch (error) {
        if (!isImagesOnlyRefusal(error)) {
          throw error
        }
        imagesOnlyModels.add(this.modelId)
      }
    }
    return this.images(prompt, ratio, signal)
  }
  private async chat({images, text}: ImagePrompt, ratio: RatioString | undefined, signal: AbortSignal) {
    const {files} = await generateText({
      model: this.provider.chat(tieredModel(this.modelId, this.tier)),
      abortSignal: signal,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text,
            },
            ...images.map(image => ({
              type: 'file' as const,
              data: image,
              mediaType: modelImageType(image) ?? 'image/png',
            })),
          ],
        },
      ],
      providerOptions: {
        openrouter: {
          modalities: ['image'],
          ...ratio ? {image_config: {aspect_ratio: ratio}} : {},
        },
      },
    })
    const image = files.find(file => file.mediaType.startsWith('image/'))
    if (!image) {
      throw new Error('The image model answered without an image.')
    }
    return toBlob(image)
  }
  private async images(prompt: ImagePrompt, ratio: RatioString | undefined, signal: AbortSignal) {
    const {image} = await generateImage({
      // `/images` knows no tiers.
      model: this.provider.imageModel(this.modelId),
      abortSignal: signal,
      maxImagesPerCall: 1,
      aspectRatio: ratio,
      prompt,
    })
    return toBlob(image)
  }
}
