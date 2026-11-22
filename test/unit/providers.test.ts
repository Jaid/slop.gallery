import {afterEach, expect, spyOn, test} from 'bun:test'

import FlavorGenerator from '../../src/lib/ai/FlavorGenerator.ts'
import FusionGenerator from '../../src/lib/ai/FusionGenerator.ts'
import * as modelImageModule from '../../src/lib/ai/modelImage.ts'
import FusionRecipe, {fusionInstruction, itemIngredient, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'

const bitmap = globalThis.createImageBitmap
/** a chat completion answering with the PNG `data` as its image, as OpenRouter answers image models */
const chatImage = (data: Uint8Array) => Response.json({
  id: 'test',
  object: 'chat.completion',
  created: 1,
  model: 'test-image-model',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: '',
        images: [{
          type: 'image_url',
          image_url: {url: `data:image/png;base64,${data.toBase64()}`},
        }],
      },
    },
  ],
})
type ChatRequest = {
  image_config?: {aspect_ratio?: string}
  messages: Array<{content: Array<{
    image_url?: {url: string}
    text?: string
    type: string
  }>}>
  modalities: Array<string>
  model: string
}
const chatRequest = (call: Parameters<typeof fetch>) => JSON.parse(call[1]!.body as string) as ChatRequest
const chatImages = (request: ChatRequest) => request.messages[0].content.filter(part => part.type === 'image_url').map(part => part.image_url!.url)
const chatText = (request: ChatRequest) => request.messages[0].content.filter(part => part.type === 'text').map(part => part.text).join('')
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined
afterEach(() => {
  fetchSpy?.mockRestore()
  globalThis.createImageBitmap = bitmap
})
test('the real text adapter consumes streamed structured output', async () => {
  globalThis.createImageBitmap = async () => ({
    width: 64,
    height: 64,
    close() {},
  })
  const flavor = {
    title: 'A remarkable misunderstanding',
    creator: 'The test curator',
    description: 'Art survives the test.',
    year: 2026,
  }
  const chunk = (content: string, finish: string | null = null) => `data: ${JSON.stringify({
    id: 'test',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'test-model',
    choices: [
      {
        index: 0,
        delta: {content},
        finish_reason: finish,
      },
    ],
  })}\n\n`
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(`${chunk(JSON.stringify(flavor)) + chunk('', 'stop')}data: [DONE]\n\n`, {headers: {'content-type': 'text/event-stream'}}))
  const partials: Array<unknown> = []
  const flavorGenerator = new FlavorGenerator({key: 'test-key'}, 'test-model')
  const result = await flavorGenerator.generate(new Blob(['pixels'], {type: 'image/webp'}), partial => partials.push(partial))
  expect(result).toEqual(flavor)
  expect(partials.length).toBeGreaterThan(0)
  expect(fetchSpy.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions')
  const request = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string) as {
    messages: Array<{content: Array<{image_url: {url: string}}>}>
    model: string
  }
  expect(request.model).toBe('test-model')
  expect(request.messages.at(-1)!.content[0].image_url.url).toStartWith('data:image/webp;base64,')
})
test('the real image adapter sends the images the ingredients contributed in their order, the hung portrait’s first, with the fusion instruction', async () => {
  const data = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(chatImage(data))
  const first = new Blob([data], {type: 'image/png'})
  const second = new Blob([Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEUAAP+KeNJXAAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')], {type: 'image/png'})
  const fusionGenerator = new FusionGenerator({key: 'test-key'}, 'test-image-model')
  const recipe = new FusionRecipe([
    portraitIngredient({
      title: 'hanging',
      source: first,
    }),
    itemIngredient('thrown', {
      contributions: [
        {
          kind: 'image',
          image: Promise.resolve(second),
        },
      ],
    }),
  ])
  const result = await fusionGenerator.generate(await recipe.content())
  expect(result.size).toBe(data.byteLength)
  expect(fetchSpy.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions')
  const request = chatRequest(fetchSpy.mock.calls[0])
  expect(request.modalities).toEqual(['image'])
  expect(chatText(request)).toBe(fusionInstruction)
  const firstImageBytes = new Uint8Array(await first.arrayBuffer())
  const secondImageBytes = new Uint8Array(await second.arrayBuffer())
  expect(chatImages(request)).toEqual([
    `data:image/png;base64,${firstImageBytes.toBase64()}`,
    `data:image/png;base64,${secondImageBytes.toBase64()}`,
  ])
})
test('the real image adapter sends an orb’s prompt verbatim with the hung portrait’s as the only image, and nothing of the orb’s look', async () => {
  const data = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(chatImage(data))
  const work = new Blob([data], {type: 'image/png'})
  const fusionGenerator = new FusionGenerator({key: 'test-key'}, 'test-image-model')
  const recipe = new FusionRecipe([
    portraitIngredient({
      title: 'work',
      source: work,
    }),
    itemIngredient('Test Orb', {
      contributions: [
        {
          kind: 'instruction',
          instruction: 'Make it spooky.',
        },
      ],
      glow: '#8a3cff',
      look: '/orbs/test.jxl',
    }),
  ])
  const result = await fusionGenerator.generate(await recipe.content())
  expect(result.size).toBe(data.byteLength)
  const request = chatRequest(fetchSpy.mock.calls[0])
  expect(chatImages(request)).toEqual([`data:image/png;base64,${data.toBase64()}`])
  expect(chatText(request)).toBe('Make it spooky.')
})
test('the real image adapter asks a known model for the supported ratio closest to the hung work and an unknown one for none', async () => {
  const data = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
  fetchSpy = spyOn(globalThis, 'fetch')
  const work = new Blob([data], {type: 'image/png'})
  const request = async (model: string, aspect?: number) => {
    fetchSpy!.mockResolvedValueOnce(chatImage(data))
    const fusionGenerator = new FusionGenerator({key: 'test-key'}, model)
    await fusionGenerator.generate({
      images: [await work.bytes(), await work.bytes()],
      text: fusionInstruction,
    }, {aspect})
    return chatRequest(fetchSpy!.mock.calls.at(-1)!)
  }
  expect(await request('google/gemini-nano-banana-2.1', 1.5)).toMatchObject({
    model: 'google/gemini-nano-banana-2.1',
    image_config: {aspect_ratio: '3:2'},
  })
  expect(await request('openai/gpt-image-2.5-sunburst', 0.6)).toHaveProperty('image_config', {aspect_ratio: '9:16'})
  expect(await request('x-ai/grok-imagine-image-2.0', 0.5)).toHaveProperty('image_config', {aspect_ratio: '1:2'})
  expect(await request('test-image-model', 1.5)).not.toHaveProperty('image_config')
  expect(await request('google/gemini-nano-banana-2.1')).not.toHaveProperty('image_config')
})
test('the real image adapter re-encodes an image of a format image models reject, like a JXL work, to WebP', async () => {
  const data = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(chatImage(data))
  // A bare JXL codestream signature, whatever its media type claims.
  const work = new Blob([new Uint8Array([0xFF, 0x0A, 0xFA, 0x1F, 0x19, 0x00])], {type: 'image/png'})
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4C])
  const encoded: Array<Blob> = []
  const toWebp = spyOn(modelImageModule, 'toWebp').mockImplementation(image => {
    encoded.push(image)
    return Promise.resolve(new Blob([webp], {type: 'image/webp'}))
  })
  const fusionGenerator = new FusionGenerator({key: 'test-key'}, 'test-image-model')
  try {
    const recipe = new FusionRecipe([
      portraitIngredient({
        title: 'work',
        source: work,
      }),
      itemIngredient('Test Orb', {
        contributions: [
          {
            kind: 'instruction',
            instruction: 'Make it spooky.',
          },
        ],
      }),
    ])
    await fusionGenerator.generate(await recipe.content())
  } finally {
    toWebp.mockRestore()
  }
  expect(encoded).toEqual([work])
  expect(chatImages(chatRequest(fetchSpy.mock.calls[0]))).toEqual([`data:image/webp;base64,${webp.toBase64()}`])
})
test('the real image adapter asks for the AI tier’s routing variant through chat', async () => {
  const data = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(chatImage(data))
  const fusionGenerator = new FusionGenerator({key: 'test-key'}, 'google/gemini-nano-banana-2.1', 'priority')
  await fusionGenerator.generate({
    images: [data],
    text: 'Make it spooky.',
  }, {aspect: 1.5})
  expect(chatRequest(fetchSpy.mock.calls[0])).toMatchObject({
    model: 'google/gemini-nano-banana-2.1:nitro',
    image_config: {aspect_ratio: '3:2'},
  })
})
test('the real image adapter falls back to the images endpoint, without a tier, for a model chat turns away, and goes there right away from then on', async () => {
  const data = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC')
  const model = 'test/images-only-model'
  const refusal = () => Response.json({error: {
    message: `${model} is an image generation model and cannot be used with the chat/completions endpoint. Use the /api/v1/images endpoint instead.`,
    code: 404,
  }}, {status: 404})
  const images = () => Response.json({
    created: 1,
    data: [{b64_json: data.toBase64()}],
  })
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(refusal()).mockResolvedValueOnce(images()).mockResolvedValueOnce(images())
  const prompt = {
    images: [data],
    text: 'Make it spooky.',
  }
  const firstGenerator = new FusionGenerator({key: 'test-key'}, model, 'priority')
  const first = await firstGenerator.generate(prompt)
  expect(first.size).toBe(data.byteLength)
  const secondGenerator = new FusionGenerator({key: 'test-key'}, model, 'priority')
  await secondGenerator.generate(prompt)
  expect(fetchSpy.mock.calls.map(call => call[0])).toEqual([
    'https://openrouter.ai/api/v1/chat/completions',
    'https://openrouter.ai/api/v1/images',
    'https://openrouter.ai/api/v1/images',
  ])
  const request = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string) as {
    input_references: Array<{image_url: {url: string}}>
    model: string
    prompt: string
  }
  expect(request.model).toBe(model)
  expect(request.prompt).toBe('Make it spooky.')
  expect(request.input_references.map(r => r.image_url.url.split(',')[1])).toEqual([data.toBase64()])
})
test('only PNG, JPEG and WebP signatures count as formats image models take', () => {
  expect(modelImageModule.modelImageType(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))).toBe('image/png')
  expect(modelImageModule.modelImageType(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]))).toBe('image/jpeg')
  expect(modelImageModule.modelImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
  expect(modelImageModule.modelImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeUndefined()
  expect(modelImageModule.modelImageType(new Uint8Array([0xFF, 0x0A, 0xFA, 0x1F]))).toBeUndefined()
  expect(modelImageModule.modelImageType(new Uint8Array([0, 0, 0, 0x0C, 0x4A, 0x58, 0x4C, 0x20]))).toBeUndefined()
})
