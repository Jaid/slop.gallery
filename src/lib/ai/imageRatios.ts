/** an aspect ratio as image models take it, width:height */
export type RatioString = `${number}:${number}`

/**
 * the aspect ratios the image models the gallery is made for accept, as https://openrouter.ai/api/v1/images/models listed them on 2026-11-22, without `auto`; the chat endpoint takes them as `image_config.aspect_ratio`
 *
 * Other models get no ratio; the result keeps whatever shape they return either way.
 */
export const imageModelRatios: Record<string, ReadonlyArray<RatioString>> = {
  'google/gemini-nano-banana-2.1': ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'],
  'openai/gpt-image-2.5-sunburst': ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '4:5', '5:4', '2:1', '1:2', '3:1', '1:3'],
  'x-ai/grok-imagine-image-2.0': ['1:1', '3:4', '4:3', '9:16', '16:9', '2:3', '3:2', '9:19.5', '19.5:9', '9:20', '20:9', '1:2', '2:1', '21:9', '5:2'],
}

/** width divided by height of the ratio */
export function ratioAspect(ratio: RatioString) {
  const [width, height] = ratio.split(':').map(Number)
  return width / height
}

/** The ratio of `ratios` closest to `aspect` (width divided by height), compared on a logarithmic scale so 1:2 and 2:1 are equally far from 1:1. */
export function closestRatio(aspect: number, ratios: ReadonlyArray<RatioString>) {
  let best: RatioString | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const ratio of ratios) {
    const distance = Math.abs(Math.log(ratioAspect(ratio) / aspect))
    if (!(distance < bestDistance)) {
      continue
    }
    best = ratio
    bestDistance = distance
  }
  return best
}

/** The ratio to ask the image model `model` for to get an image shaped like `aspect` (width divided by height), or `undefined` for a model whose ratios are unknown. */
export function requestedRatio(model: string, aspect: number) {
  if (!Object.hasOwn(imageModelRatios, model) || !(aspect > 0) || !Number.isFinite(aspect)) {
    return
  }
  return closestRatio(aspect, imageModelRatios[model])
}
