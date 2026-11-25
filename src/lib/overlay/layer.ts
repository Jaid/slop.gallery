import type {OverlayLineStyle} from './tuning.ts'

import hsl from 'okhsl'

import {cssHex} from '../color.ts'
import {overlayLineWidth} from './tuning.ts'

export type DistanceFade = {
  end: number
  heightWeight: number
  power: number
  start: number
}
export type LayerOptions = {
  color?: number | string
  fade?: Partial<DistanceFade> | false
  id: string
  lineStyle?: OverlayLineStyle
  lineWidth?: number
  obstructedOpacityFactor?: number
  priority?: number
}
export const defaultLayer = 'default'
export const defaultLayerColor = hsl.integer(29.2, 100, 56.8)
export const defaultFade: Readonly<DistanceFade> = {
  start: 16,
  end: 100,
  heightWeight: 5,
  power: 10,
}
export const layerIdSchema = {
  type: 'string',
  pattern: String.raw`\S`,
  description: 'A nonblank, page-local layer ID.',
}
export const hexColor = /^#(?:[0-9A-Fa-f]{3}){1,2}$/u
const fadeProperties = {
  start: {
    type: 'number',
    minimum: 0,
    default: defaultFade.start,
  },
  end: {
    type: 'number',
    exclusiveMinimum: 0,
    default: defaultFade.end,
  },
  heightWeight: {
    type: 'number',
    minimum: 0,
    default: defaultFade.heightWeight,
  },
  power: {
    type: 'number',
    exclusiveMinimum: 0,
    default: defaultFade.power,
  },
}
export const layerSchema = {
  type: 'object',
  properties: {
    id: layerIdSchema,
    obstructedOpacityFactor: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      default: 1,
      description: 'Multiplier for stroke opacity only where a nearer world surface writes depth. 0 hides, 1 ignores obstructions.',
    },
    priority: {
      type: 'number',
      default: 0,
      description: 'Higher layers draw on top.',
    },
    color: {
      type: 'string',
      pattern: hexColor.source,
      default: cssHex(defaultLayerColor),
    },
    lineWidth: {
      type: 'integer',
      minimum: overlayLineWidth.min,
      maximum: overlayLineWidth.max,
      description: `Omit to follow the live overlay width (initial default: ${overlayLineWidth.default}). 100 is 1 px at 1920×1080. Width scales with the square root of the viewport area.`,
    },
    lineStyle: {
      type: 'string',
      enum: ['aliased', 'barycentric'],
      description: 'Omit to follow the live overlay line style.',
    },
    fade: {
      oneOf: [{const: false}, {
        type: 'object',
        properties: fadeProperties,
        additionalProperties: false,
      }],
      default: false,
      description: 'Optional weighted distance fade in meters. Solid through start, invisible at end; end must exceed start. Pass false to disable fading.',
    },
  },
  required: ['id'],
  additionalProperties: false,
}
export const isLayerId = (id: unknown): id is string => typeof id === 'string' && /\S/u.test(id)
const isRecord = (input: unknown): input is Record<string, unknown> => !!input && typeof input === 'object' && !Array.isArray(input)

export function readLayer(input: unknown, source: 'code' | 'webmcp' = 'webmcp'): LayerOptions {
  if (!isRecord(input) || !isLayerId(input.id) || Object.keys(input).some(key => !Object.hasOwn(layerSchema.properties, key))) {
    throw new TypeError('Expected layer options with a nonblank id.')
  }
  const {obstructedOpacityFactor} = input
  if (obstructedOpacityFactor !== undefined && !(typeof obstructedOpacityFactor === 'number' && obstructedOpacityFactor >= 0 && obstructedOpacityFactor <= 1)) {
    throw new RangeError('obstructedOpacityFactor must be a number from 0 to 1.')
  }
  const {color, priority, lineStyle, lineWidth, fade} = input
  if (color !== undefined && !(typeof color === 'string' && hexColor.test(color))) {
    if (source !== 'code' || typeof color !== 'number' || !Number.isInteger(color) || color < 0 || color >= 2 ** 24) {
      throw new TypeError(source === 'code' ? 'Layer color must be packed sRGB or hex RGB.' : 'Layer color must be hex RGB.')
    }
  }
  if (priority !== undefined && !Number.isFinite(priority)) {
    throw new TypeError('Layer priority must be finite.')
  }
  if (lineStyle !== undefined && lineStyle !== 'aliased' && lineStyle !== 'barycentric') {
    throw new TypeError('Layer lineStyle must be aliased or barycentric.')
  }
  if (lineWidth !== undefined && !(typeof lineWidth === 'number' && Number.isInteger(lineWidth) && lineWidth >= overlayLineWidth.min && lineWidth <= overlayLineWidth.max)) {
    throw new TypeError(`Layer lineWidth must be an integer from ${overlayLineWidth.min} to ${overlayLineWidth.max}.`)
  }
  if (fade !== undefined && fade !== false) {
    if (!isRecord(fade) || Object.entries(fade).some(([key, value]) => !Object.hasOwn(fadeProperties, key) || typeof value !== 'number' || !Number.isFinite(Math.fround(value)))) {
      throw new TypeError('Expected finite layer fade settings or false.')
    }
    const {start, end, power, heightWeight} = {
      ...defaultFade,
      ...fade,
    }
    if (!(start >= 0 && Math.fround(end) > Math.fround(start) && Math.fround(power) > 0 && heightWeight >= 0)) {
      throw new RangeError('Layer fade needs 0 ≤ start < end, power > 0 and heightWeight ≥ 0.')
    }
  }
  return input as LayerOptions
}
