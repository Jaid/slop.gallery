import type {OpenRouterAccess} from './openRouterAccess.ts'
import type {OpenRouterProviderOptions} from '@openrouter/ai-sdk-provider'
import type {FilePart} from 'ai'

import {jsonSchema, Output, streamText} from 'ai'

import SdkGenerator from './SdkGenerator.ts'

type GeneratedFlavor = {
  creator: string
  description: string
  title: string
  year: number
}
const makeAttachment = async (image: Blob): Promise<FilePart> => {
  const maxSize = 768
  const bitmap = await createImageBitmap(image)
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const needsScaling = scale < 1
    const needsReencoding = image.type !== 'image/webp'
    if (!needsScaling && !needsReencoding) {
      return {
        type: 'file',
        data: await image.arrayBuffer(),
        mediaType: image.type,
      }
    }
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create 2D canvas context for flavor image')
    }
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    const encoded = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.9,
    })
    return {
      type: 'file',
      data: await encoded.arrayBuffer(),
      mediaType: 'image/webp',
    }
  } finally {
    bitmap.close()
  }
}
export default class extends SdkGenerator {
  readonly model: Parameters<typeof streamText>[0]['model']
  readonly outputShape = Output.object({
    schema: jsonSchema<GeneratedFlavor>({
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'a creative and clever title, consisting of 2–6 words',
        },
        description: {
          type: 'string',
          description: 'a witty, entertaining gallery description in 1–3 short sentences, at most 65 words',
        },
        creator: {
          type: 'string',
          description: 'name or pseudonym or any other identifier pointing to who or what created the work',
        },
        year: {
          type: 'number',
          description: 'estimated year of creation',
        },
      },
      required: ['title', 'description', 'creator', 'year'],
      additionalProperties: false,
    }),
  })
  constructor(access: OpenRouterAccess, model: string, effort: Extract<NonNullable<OpenRouterProviderOptions['reasoning']>, {effort: unknown}>['effort'] = 'low') {
    super(access)
    this.model = this.provider.chat(model, {reasoning: {effort}})
  }
  async generate(image: Blob, onPartial?: (flavor: Partial<GeneratedFlavor>) => void, signal?: AbortSignal) {
    const attachment = await makeAttachment(image)
    const result = streamText({
      model: this.model,
      abortSignal: signal ?? AbortSignal.timeout(90_000),
      output: this.outputShape,
      instructions: 'You are a genius flavor text writer with remarkable eloquence and distinctive humor.\n\nThe provided image will be displayed as a portrait in an art gallery game. It specifically targets an adult audience, so no need to hold back and shy away from sensitive topics. Please respond with what will be shown on the plate below the portrait. Make up something clever, entertaining and fitting based on the picture’s content or what the picture means or what it represents or subtly refers to.\n\nNo need to describe the pictorial characteristics like art style or color palette as the player is already looking at the image while your texts are displayed and optionally read aloud',
      prompt: [
        {
          role: 'user',
          content: [attachment],
        },
      ],
    })
    for await (const partial of result.partialOutputStream) {
      onPartial?.(partial)
    }
    return result.output
  }
}
