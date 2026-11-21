import type {Vec3} from 'math'

import {hexColor, isLayerId, layerIdSchema} from './layer.ts'

export type Drawing = {[K in keyof Shapes]: Shapes[K] & {
  color?: string
  layer?: string
  type: K
}}[keyof Shapes]
type Shapes = {
  box: {
    max: Vec3
    min: Vec3
  }
  camera_facing_rectangle: {
    center: Vec3
    height: number
    width: number
  }
  circle: {
    center: Vec3
    normal?: Vec3
    radius: number
  }
  line: {
    from: Vec3
    to: Vec3
  }
  point: {
    position: Vec3
    radius?: number
  }
  sphere: {
    center: Vec3
    radius: number
  }
  triangle: {
    a: Vec3
    b: Vec3
    c: Vec3
  }
  viewport_rectangle: {
    height: number
    width: number
    x: number
    y: number
  }
}
const vector = {
  type: 'array',
  items: {type: 'number'},
  minItems: 3,
  maxItems: 3,
}
const positiveLength = {
  type: 'number',
  exclusiveMinimum: 0,
}
const lengths = new Set(['radius', 'width', 'height'])
const coordinates = new Set(['x', 'y'])
const fieldSchema = (key: string) => (lengths.has(key) ? positiveLength : (coordinates.has(key) ? {type: 'number'} : vector))
const layouts = {
  camera_facing_rectangle: {
    required: ['center', 'width', 'height'],
    optional: [],
  },
  viewport_rectangle: {
    required: ['x', 'y', 'width', 'height'],
    optional: [],
  },
  box: {
    required: ['min', 'max'],
    optional: [],
  },
  circle: {
    required: ['center', 'radius'],
    optional: ['normal'],
  },
  line: {
    required: ['from', 'to'],
    optional: [],
  },
  point: {
    required: ['position'],
    optional: ['radius'],
  },
  sphere: {
    required: ['center', 'radius'],
    optional: [],
  },
  triangle: {
    required: ['a', 'b', 'c'],
    optional: [],
  },
} satisfies Record<keyof Shapes, {
  optional: Array<string>
  required: Array<string>
}>

export const drawingSchema = {oneOf: Object.entries(layouts).map(([kind, {required, optional}]) => ({
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: kind,
    },
    layer: layerIdSchema,
    color: {
      type: 'string',
      pattern: hexColor.source,
      description: 'Hex RGB override, otherwise the layer color',
    },
    ...Object.fromEntries([...required, ...optional].map(key => [key, fieldSchema(key)])),
  },
  required: ['type', ...required],
  additionalProperties: false,
}))}

/** Validate the drawing add_drawing takes as its input before creating geometry. */
export function readDrawing(value: unknown): Drawing {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('type' in value) || typeof value.type !== 'string' || !Object.hasOwn(layouts, value.type)) {
    throw new TypeError(`Expected type to be one of: ${Object.keys(layouts).join(', ')}.`)
  }
  const fields = value as Record<string, unknown>
  const {required, optional} = layouts[value.type as keyof Shapes]
  const keys: Array<string> = [...required, ...optional]
  if (Object.keys(fields).some(key => !['color', 'layer', 'type', ...keys].includes(key)) || required.some(key => !Object.hasOwn(fields, key))) {
    throw new TypeError(`Unexpected or missing fields for drawing type ${value.type}`)
  }
  if (fields.layer !== undefined && !isLayerId(fields.layer)) {
    throw new TypeError('layer must be a nonblank layer ID.')
  }
  if (fields.color !== undefined && !(typeof fields.color === 'string' && hexColor.test(fields.color))) {
    throw new TypeError('color must be a hex RGB color.')
  }
  for (const key of keys) {
    if (!Object.hasOwn(fields, key)) {
      continue
    }
    const v = fields[key]
    if (lengths.has(key)) {
      if (!(typeof v === 'number' && Math.fround(v) > 0 && Number.isFinite(Math.fround(v)))) {
        throw new TypeError(`${key} must be positive and finite.`)
      }
    } else if (coordinates.has(key)) {
      if (!(typeof v === 'number' && Number.isFinite(Math.fround(v)))) {
        throw new TypeError(`${key} must be finite.`)
      }
    } else if (!(Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(Math.fround(n))))) {
      throw new TypeError(`${key} must be a finite [x,y,z] vector.`)
    }
  }
  const drawing = value as Drawing
  if (drawing.type === 'circle' && drawing.normal?.every(n => n === 0)) {
    throw new TypeError('normal must not be zero.')
  }
  if (drawing.type === 'box' && drawing.min.some((n, i) => n > drawing.max[i])) {
    throw new TypeError('min must not exceed max on any axis.')
  }
  return drawing
}
