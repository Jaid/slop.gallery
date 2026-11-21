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
  triangle: {
    a: Vec3
    b: Vec3
    c: Vec3
  }
}
const vector = {
  type: 'array',
  items: {type: 'number'},
  minItems: 3,
  maxItems: 3,
}
const radius = {
  type: 'number',
  exclusiveMinimum: 0,
}
const layouts = {
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
    ...Object.fromEntries([...required, ...optional].map(key => [key, key === 'radius' ? radius : vector])),
  },
  required: ['type', ...required],
  additionalProperties: false,
}))}

/** Validate the tool’s drawing before creating geometry. */
export function readDrawing(value: unknown): Drawing {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('type' in value) || typeof value.type !== 'string' || !Object.hasOwn(layouts, value.type)) {
    throw new TypeError('drawing.type must be box, circle, line, point or triangle.')
  }
  const fields = value as Record<string, unknown>
  const {required, optional} = layouts[value.type as keyof Shapes]
  const keys: Array<string> = [...required, ...optional]
  if (Object.keys(fields).some(key => !['color', 'layer', 'type', ...keys].includes(key)) || required.some(key => !Object.hasOwn(fields, key))) {
    throw new TypeError(`Unexpected or missing fields for drawing type ${value.type}`)
  }
  if (fields.layer !== undefined && !isLayerId(fields.layer)) {
    throw new TypeError('drawing.layer must be a nonblank layer ID.')
  }
  if (fields.color !== undefined && !(typeof fields.color === 'string' && hexColor.test(fields.color))) {
    throw new TypeError('drawing.color must be a hex RGB color.')
  }
  for (const key of keys) {
    if (!Object.hasOwn(fields, key)) {
      continue
    }
    const v = fields[key]
    if (key === 'radius') {
      if (!(typeof v === 'number' && Math.fround(v) > 0 && Number.isFinite(Math.fround(v)))) {
        throw new TypeError('drawing.radius must be a positive finite distance.')
      }
    } else if (!(Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(Math.fround(n))))) {
      throw new TypeError(`drawing.${key} must be a finite [x,y,z] vector.`)
    }
  }
  const drawing = value as Drawing
  if (drawing.type === 'circle' && drawing.normal?.every(n => n === 0)) {
    throw new TypeError('drawing.normal must not be zero.')
  }
  if (drawing.type === 'box' && drawing.min.some((n, i) => n > drawing.max[i])) {
    throw new TypeError('drawing.min must not exceed drawing.max on any axis.')
  }
  return drawing
}
