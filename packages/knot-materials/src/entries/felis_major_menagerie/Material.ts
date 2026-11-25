import type {Vec3 as Vector} from 'math'
import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {array, color, float, Fn, If, int, Loop, max, mix, modelWorldMatrixInverse, mx_atan2, mx_fractal_noise_float, mx_noise_float, negateOnBackSide, normalViewGeometry, positionView, positionViewDirection, select, step, struct, time, transformNormalToView, uniformArray, uv, varying, vec2, vec3, vec4} from 'three/tsl'
import {Vector4} from 'three/webgpu'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotCurve} from '../../lib/knotCurve.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {add, cross, normalize, scale as scaleVector, sub, length as vectorLength} from '../../lib/tripleMath.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Each constellation belongs to a breed: precious-metal threads and stars, a deep facet tint, a faint blush and the only saturated color – the eyes. */
type Breed = {
  blush: number
  fill: number
  iris: number
  line: number
  star: number
}
const breeds: Array<Breed> = [
  // gold threads, jade eyes
  {
    line: hsl.integer(75, 100, 87.7),
    star: hsl.integer(83, 100, 96.6),
    fill: hsl.integer(294, 65, 30),
    blush: hsl.integer(30, 100, 75),
    iris: hsl.integer(156, 100, 88.4),
  },
  // silver threads, amber eyes
  {
    line: hsl.integer(262, 100, 84.5),
    star: hsl.integer(260, 100, 97),
    fill: hsl.integer(265, 77, 28),
    blush: hsl.integer(310, 100, 76),
    iris: hsl.integer(80, 100, 81.4),
  },
  // rose-gold threads, sapphire eyes
  {
    line: hsl.integer(35, 100, 83.5),
    star: hsl.integer(35, 100, 96),
    fill: hsl.integer(322, 66, 27),
    blush: hsl.integer(2, 100, 74),
    iris: hsl.integer(228, 100, 78),
  },
  // platinum threads, copper eyes
  {
    line: hsl.integer(215, 100, 90.6),
    star: hsl.integer(213, 100, 98),
    fill: hsl.integer(226, 77, 26),
    blush: hsl.integer(77, 100, 86.5),
    iris: hsl.integer(54, 99, 72),
  },
  // lilac threads, chartreuse eyes
  {
    line: hsl.integer(301, 100, 84.6),
    star: hsl.integer(304, 100, 96),
    fill: hsl.integer(291, 74, 22),
    blush: hsl.integer(344, 100, 77.6),
    iris: hsl.integer(122.9, 100, 92.7),
  },
]
/** The low-poly cat head every constellation is built from, in cat units: x spans about ±1, y points from the chin (−0.6) to the ear tips (+0.98) and z is a relief height used for facet normals and for the head turning toward the viewer. Only the right half is authored; everything with x > 0 is mirrored. Faces are triangles and quads – quads keep their diagonal invisible, so the wireframe really reads as a mix of both. */
type CatVertexName = 'bridge' | 'brow' | 'browSide' | 'cheek' | 'cheekTop' | 'chin' | 'chinSide' | 'crown' | 'earInner' | 'earMid' | 'earOuter' | 'earTip' | 'eyeBottom' | 'eyeInner' | 'eyeOuter' | 'eyeTop' | 'jaw' | 'mouth' | 'noseTip' | 'noseWing' | 'temple' | 'whiskerPad'
type CatFaceGroup = 'cheek' | 'chin' | 'ear' | 'eye' | 'forehead' | 'innerEar' | 'muzzle' | 'nose'

type CatSide = -1 | 0 | 1
type CatVertex = {
  /** displacement per unit of the “chub” morph (rounder, wider face) */
  chub: [number, number]
  /** displacement per unit of the “ear” morph (taller, more pointed ears) */
  ear: [number, number]
  /** stable index into CatMesh.vertices */
  index: number
  name: CatVertexName
  side: CatSide
  x: number
  y: number
  z: number
}
type CatFace = {
  group: CatFaceGroup
  /** counter-clockwise vertex indices, 3 or 4 of them */
  indices: Array<number>
}
type CatEdge = {
  a: number
  b: number
  /** whether the edge lies on the silhouette of the head */
  outline: boolean
}
type CatWhisker = {
  from: [number, number]
  side: -1 | 1
  to: [number, number]
}
type Authored = {
  at: [number, number, number]
  chub?: [number, number]
  ear?: [number, number]
  name: CatVertexName
}
function pick(index: Node<'float'>, values: Array<Node<'color'>>) {
  let result = values[0]
  for (let k = 1;k < values.length;k++) {
    result = select(index.greaterThan(k - 0.5), values[k], result)
  }
  return result
}
/** Linear-light palette of the breed with the given integer index. */
function breedPalette(index: Node<'float'>) {
  const channel = (key: keyof Breed) => pick(index, breeds.map(breed => color(breed[key])))
  return {
    line: channel('line'),
    star: channel('star'),
    fill: channel('fill'),
    blush: channel('blush'),
    iris: channel('iris'),
  }
}
const authored: Array<Authored> = [
  {
    name: 'crown',
    at: [0, 0.66, 0.3],
    ear: [0, -0.03],
  },
  {
    name: 'brow',
    at: [0, 0.34, 0.46],
  },
  {
    name: 'bridge',
    at: [0, -0.01, 0.6],
  },
  {
    name: 'noseTip',
    at: [0, -0.22, 0.8],
  },
  {
    name: 'mouth',
    at: [0, -0.4, 0.64],
  },
  {
    name: 'chin',
    at: [0, -0.57, 0.42],
    chub: [0, -0.04],
  },
  {
    name: 'earTip',
    at: [0.8, 1.04, 0.14],
    ear: [0.02, 0.2],
    chub: [0.06, -0.08],
  },
  {
    name: 'earMid',
    at: [0.64, 0.6, 0.26],
    ear: [0.01, 0.05],
    chub: [0.03, -0.03],
  },
  {
    name: 'earInner',
    at: [0.3, 0.62, 0.28],
    ear: [-0.02, 0.02],
  },
  {
    name: 'earOuter',
    at: [0.95, 0.36, 0.1],
    ear: [0.01, 0.02],
    chub: [0.05, 0],
  },
  {
    name: 'browSide',
    at: [0.4, 0.34, 0.4],
  },
  {
    name: 'temple',
    at: [0.78, 0.24, 0.22],
    chub: [0.04, 0],
  },
  {
    name: 'eyeInner',
    at: [0.15, 0.04, 0.46],
  },
  {
    name: 'eyeTop',
    at: [0.39, 0.24, 0.44],
  },
  {
    name: 'eyeOuter',
    at: [0.66, 0.04, 0.36],
    chub: [0.02, 0],
  },
  {
    name: 'eyeBottom',
    at: [0.4, -0.13, 0.46],
  },
  {
    name: 'cheekTop',
    at: [0.42, -0.25, 0.54],
    chub: [0.03, -0.01],
  },
  {
    name: 'cheek',
    at: [0.96, -0.15, 0.04],
    chub: [0.12, -0.02],
  },
  {
    name: 'noseWing',
    at: [0.12, -0.08, 0.7],
  },
  {
    name: 'whiskerPad',
    at: [0.3, -0.36, 0.62],
    chub: [0.03, -0.01],
  },
  {
    name: 'jaw',
    at: [0.6, -0.43, 0.14],
    chub: [0.1, -0.05],
  },
  {
    name: 'chinSide',
    at: [0.25, -0.53, 0.4],
    chub: [0.04, -0.04],
  },
]
// Right-side polygons; any vertex name without a mirror (crown, brow, …) is shared by both halves.
const rightFaces: Array<{
  group: CatFaceGroup
  names: Array<CatVertexName>
}> = [
  {
    group: 'innerEar',
    names: ['earTip', 'earInner', 'earMid'],
  },
  {
    group: 'ear',
    names: ['earTip', 'earMid', 'earOuter'],
  },
  {
    group: 'forehead',
    names: ['earInner', 'earMid', 'temple', 'browSide'],
  },
  {
    group: 'forehead',
    names: ['earMid', 'earOuter', 'temple'],
  },
  {
    group: 'forehead',
    names: ['crown', 'earInner', 'browSide', 'brow'],
  },
  {
    group: 'forehead',
    names: ['brow', 'browSide', 'eyeInner'],
  },
  {
    group: 'forehead',
    names: ['browSide', 'eyeTop', 'eyeInner'],
  },
  {
    group: 'forehead',
    names: ['browSide', 'temple', 'eyeOuter', 'eyeTop'],
  },
  {
    group: 'eye',
    names: ['eyeInner', 'eyeTop', 'eyeOuter', 'eyeBottom'],
  },
  {
    group: 'cheek',
    names: ['temple', 'earOuter', 'cheek', 'eyeOuter'],
  },
  {
    group: 'cheek',
    names: ['eyeOuter', 'cheek', 'cheekTop', 'eyeBottom'],
  },
  {
    group: 'muzzle',
    names: ['eyeInner', 'eyeBottom', 'cheekTop', 'noseWing'],
  },
  {
    group: 'muzzle',
    names: ['bridge', 'eyeInner', 'noseWing'],
  },
  {
    group: 'muzzle',
    names: ['noseWing', 'cheekTop', 'noseTip'],
  },
  {
    group: 'muzzle',
    names: ['noseTip', 'cheekTop', 'whiskerPad', 'mouth'],
  },
  {
    group: 'cheek',
    names: ['cheekTop', 'cheek', 'jaw', 'whiskerPad'],
  },
  {
    group: 'chin',
    names: ['whiskerPad', 'jaw', 'chinSide', 'mouth'],
  },
  {
    group: 'chin',
    names: ['mouth', 'chinSide', 'chin'],
  },
]
const centerFaces: Array<{
  group: CatFaceGroup
  names: Array<[CatVertexName, CatSide]>
}> = [
  {
    group: 'muzzle',
    names: [['brow', 0], ['eyeInner', -1], ['bridge', 0], ['eyeInner', 1]],
  },
  {
    group: 'muzzle',
    names: [['bridge', 0], ['noseWing', -1], ['noseWing', 1]],
  },
  {
    group: 'nose',
    names: [['noseWing', -1], ['noseTip', 0], ['noseWing', 1]],
  },
]
const whiskerRoots: Array<{
  from: [number, number]
  to: [number, number]
}> = [
  {
    from: [0.34, -0.32],
    to: [1.28, -0.18],
  },
  {
    from: [0.36, -0.36],
    to: [1.32, -0.38],
  },
  {
    from: [0.34, -0.4],
    to: [1.22, -0.58],
  },
]
/** Order-independent key of the edge between two vertex indices. */
const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)
class CatMesh {
  readonly edges: Array<CatEdge> = []
  readonly faces: Array<CatFace> = []
  readonly vertices: Array<CatVertex> = []
  readonly whiskers: Array<CatWhisker> = []
  private readonly lookup = new Map<string, number>
  constructor() {
    for (const entry of authored) {
      const sides: Array<CatSide> = entry.at[0] === 0 ? [0] : [-1, 1]
      for (const side of sides) {
        const mirror = side === 0 ? 1 : side
        const index = this.vertices.length
        this.vertices.push({
          index,
          name: entry.name,
          side,
          x: entry.at[0] * mirror,
          y: entry.at[1],
          z: entry.at[2],
          ear: [(entry.ear?.[0] ?? 0) * mirror, entry.ear?.[1] ?? 0],
          chub: [(entry.chub?.[0] ?? 0) * mirror, entry.chub?.[1] ?? 0],
        })
        this.lookup.set(`${entry.name}:${side}`, index)
      }
    }
    for (const face of rightFaces) {
      for (const side of [1, -1] as const) {
        const indices = face.names.map(name => this.find(name, side))
        this.addFace(face.group, indices)
      }
    }
    for (const face of centerFaces) {
      this.addFace(face.group, face.names.map(([name, side]) => this.find(name, side)))
    }
    this.buildEdges()
    for (const root of whiskerRoots) {
      for (const side of [1, -1] as const) {
        this.whiskers.push({
          side,
          from: [root.from[0] * side, root.from[1]],
          to: [root.to[0] * side, root.to[1]],
        })
      }
    }
    this.validate()
  }
  /** signed area of the polygon, positive for counter-clockwise order */
  area(indices: Array<number>) {
    let sum = 0
    for (const [k, index] of indices.entries()) {
      const a = this.vertices[index]
      const b = this.vertices[indices[(k + 1) % indices.length]]
      sum += a.x * b.y - b.x * a.y
    }
    return sum / 2
  }
  find(name: CatVertexName, side: CatSide) {
    const index = this.lookup.get(`${name}:${side}`) ?? this.lookup.get(`${name}:0`)
    if (index === undefined) {
      throw new Error(`Unknown cat vertex ${name} on side ${side}.`)
    }
    return index
  }
  /** split a face into counter-clockwise triangles for point-in-face tests */
  triangles(face: CatFace): Array<[number, number, number]> {
    const [a, b, c] = face.indices
    const d = face.indices.at(3)
    return d === undefined ? [[a, b, c]] : [[a, b, c], [a, c, d]]
  }
  private addFace(group: CatFaceGroup, indices: Array<number>) {
    const ordered = this.area(indices) < 0 ? indices.toReversed() : indices
    this.faces.push({
      group,
      indices: ordered,
    })
  }
  private buildEdges() {
    const uses = new Map<string, number>
    for (const face of this.faces) {
      for (const [k, a] of face.indices.entries()) {
        const b = face.indices[(k + 1) % face.indices.length]
        uses.set(edgeKey(a, b), (uses.get(edgeKey(a, b)) ?? 0) + 1)
      }
    }
    for (const [id, count] of uses) {
      const [a, b] = id.split(':').map(Number)
      this.edges.push({
        a,
        b,
        outline: count === 1,
      })
    }
  }
  private outlineArea() {
    const next = new Map<number, number>
    for (const face of this.faces) {
      for (const [k, a] of face.indices.entries()) {
        const b = face.indices[(k + 1) % face.indices.length]
        const shared = this.faces.some(other => other !== face && other.indices.includes(a) && other.indices.includes(b))
        if (!shared) {
          next.set(a, b)
        }
      }
    }
    const start = next.keys().next().value!
    const loop = [start]
    for (let current = next.get(start)!;current !== start;current = next.get(current)!) {
      loop.push(current)
      if (loop.length > next.size) {
        throw new Error('Cat outline is not a single loop.')
      }
    }
    if (loop.length !== next.size) {
      throw new Error('Cat outline is not a single loop.')
    }
    return this.area(loop)
  }
  private validate() {
    for (const face of this.faces) {
      if (face.indices.length < 3 || face.indices.length > 4) {
        throw new Error('Cat faces must be triangles or quads.')
      }
      // Every face must be strictly convex so the two-triangle inside test and the diagonal normal agree.
      const n = face.indices.length
      for (let k = 0;k < n;k++) {
        const a = this.vertices[face.indices[k]]
        const b = this.vertices[face.indices[(k + 1) % n]]
        const c = this.vertices[face.indices[(k + 2) % n]]
        const turn = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
        if (turn <= 0.002) {
          throw new Error(`Cat face ${face.indices.map(index => `${this.vertices[index].name}:${this.vertices[index].side}`).join(',')} is not convex.`)
        }
      }
    }
    for (const edge of this.edges) {
      const count = this.faces.filter(face => face.indices.includes(edge.a) && face.indices.includes(edge.b)).length
      if (count > 2) {
        throw new Error('Cat mesh edge shared by more than two faces.')
      }
    }
    const total = this.faces.reduce((sum, face) => sum + this.area(face.indices), 0)
    const outline = this.outlineArea()
    if (Math.abs(total - outline) > 1e-9) {
      throw new Error(`Cat faces overlap or leave holes: ${total} ≠ ${outline}.`)
    }
  }
}
const catMesh = new CatMesh
/** Build-time acceleration tables for the constellation shader. A settled cat only moves within known bounds: its per-cat morphs (ears, cheeks, eye shape, folded ears, cocked head) and its small live motions (blinks, ear twitches). Breathing and the head turn are applied to the fragment instead of the vertices, so every vertex stays inside a precomputed box. The cat plane is cut into bins, and each bin lists only the vertices, edges and faces that can possibly affect a fragment inside it – so the shader walks a handful of elements instead of the whole mesh. */
/** Ranges of the per-cat shape parameters, which the shader must respect. */
const shapeRanges = {
  ear: [-0.8, 1.2],
  chub: [-0.8, 1.2],
  roundEyes: [-0.45, 0.55],
  cock: [-0.07, 0.07],
} as const
/** Offsets of the small per-vertex motions, per unit of their parameter. */
const motions = {
  eyeTopRound: 0.1,
  eyeBottomRound: -0.07,
  foldTip: [-0.15, -0.32],
  foldMid: [-0.05, -0.1],
  twitch: [0.1, -0.12],
  twitchMid: 0.4,
  blinkTarget: catMesh.vertices[catMesh.find('eyeInner', 1)].y - 0.05,
  lid: 0.012,
} as const
type Box = {
  maxX: number
  maxY: number
  minX: number
  minY: number
}
/** Every position a settled vertex can take, sampled at the corners of the parameter ranges. */
function reachOf(vertex: CatVertex) {
  const points: Array<[number, number]> = []
  for (const ear of shapeRanges.ear) {
    for (const chub of shapeRanges.chub) {
      for (const round of shapeRanges.roundEyes) {
        for (const fold of [0, 1]) {
          for (const cock of shapeRanges.cock) {
            for (const twitch of [0, 1]) {
              for (const blink of [0, 1]) {
                let x = vertex.x + vertex.ear[0] * ear + vertex.chub[0] * chub
                let y = vertex.y + vertex.ear[1] * ear + vertex.chub[1] * chub
                if (vertex.name === 'eyeTop') {
                  y += round * motions.eyeTopRound
                }
                if (vertex.name === 'eyeBottom') {
                  y += round * motions.eyeBottomRound
                }
                if (vertex.name === 'earTip') {
                  x += vertex.side * motions.foldTip[0] * fold + cock + vertex.side * motions.twitch[0] * twitch
                  y += motions.foldTip[1] * fold - cock * vertex.side * 0.5 + motions.twitch[1] * twitch
                }
                if (vertex.name === 'earMid') {
                  x += vertex.side * (motions.foldMid[0] * fold + motions.twitch[0] * motions.twitchMid * twitch)
                  y += motions.foldMid[1] * fold + motions.twitch[1] * motions.twitchMid * twitch
                }
                if ((vertex.name === 'eyeTop' || vertex.name === 'eyeBottom') && blink) {
                  y = motions.blinkTarget + (vertex.name === 'eyeTop' ? motions.lid : -motions.lid)
                }
                points.push([x, y])
              }
            }
          }
        }
      }
    }
  }
  return points
}
const boxOf = (points: Array<[number, number]>, margin: number): Box => ({
  minX: Math.min(...points.map(point => point[0])) - margin,
  minY: Math.min(...points.map(point => point[1])) - margin,
  maxX: Math.max(...points.map(point => point[0])) + margin,
  maxY: Math.max(...points.map(point => point[1])) + margin,
})
const overlaps = (a: Box, b: Box) => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
/** How far each element reaches beyond its geometry: star spikes and halos, thread glow and purr, facet anti-aliasing. */
const starReach = 0.3
const edgeReach = 0.16
const faceReach = 0.03
/** The binned part of the cat plane; fragments outside it are far from every element. */
const binDomain = {
  minX: -1.6,
  minY: -1.1,
  maxX: 1.6,
  maxY: 1.6,
  columns: 10,
  rows: 9,
} as const
const reaches = catMesh.vertices.map(reachOf)
const vertexBoxes = reaches.map(points => boxOf(points, starReach))
const edgeBoxes = catMesh.edges.map(edge => boxOf([...reaches[edge.a], ...reaches[edge.b]], edgeReach))
const faceBoxes = catMesh.faces.map(face => boxOf(face.indices.flatMap(index => reaches[index]), faceReach))
type Bin = {
  /** edges (earlier-lit end first) with the outline flag */
  edges: Array<{
    from: number
    outline: boolean
    to: number
  }>
  /** faces as four vertex indices (triangles repeat their last vertex) with their face index */
  faces: Array<{
    corners: [number, number, number, number]
    face: number
  }>
  /** vertices whose stars can reach into the bin */
  vertices: Array<number>
}
function buildBins(keyOf: (vertex: CatVertex) => number) {
  const bins: Array<Bin> = []
  const width = (binDomain.maxX - binDomain.minX) / binDomain.columns
  const height = (binDomain.maxY - binDomain.minY) / binDomain.rows
  for (let row = 0;row < binDomain.rows;row++) {
    for (let column = 0;column < binDomain.columns;column++) {
      const box: Box = {
        minX: binDomain.minX + column * width,
        minY: binDomain.minY + row * height,
        maxX: binDomain.minX + (column + 1) * width,
        maxY: binDomain.minY + (row + 1) * height,
      }
      const vertices = vertexBoxes.flatMap((vertexBox, vertex) => (overlaps(box, vertexBox) ? vertex : []))
      const edges = catMesh.edges.flatMap((edge, index) => {
        if (!overlaps(box, edgeBoxes[index])) {
          return []
        }
        const [from, to] = keyOf(catMesh.vertices[edge.a]) <= keyOf(catMesh.vertices[edge.b]) ? [edge.a, edge.b] : [edge.b, edge.a]
        return {
          from,
          to,
          outline: edge.outline,
        }
      })
      const faces = catMesh.faces.flatMap((face, index) => {
        if (!overlaps(box, faceBoxes[index])) {
          return []
        }
        return {
          corners: [face.indices[0], face.indices[1], face.indices[2], face.indices[3] ?? face.indices[2]] as [number, number, number, number],
          face: index,
        }
      })
      bins.push({
        vertices,
        edges,
        faces,
      })
    }
  }
  // Two special bins: nothing (outside the binned area of a settled cat) and everything (a cat in motion).
  bins.push({
    vertices: [],
    edges: [],
    faces: [],
  })
  bins.push({vertices: catMesh.vertices.map(vertex => vertex.index), edges: catMesh.edges.map(edge => {
    const [from, to] = keyOf(catMesh.vertices[edge.a]) <= keyOf(catMesh.vertices[edge.b]) ? [edge.a, edge.b] : [edge.b, edge.a]
    return {
      from,
      to,
      outline: edge.outline,
    }
  }), faces: catMesh.faces.map((face, index) => ({
    corners: [face.indices[0], face.indices[1], face.indices[2], face.indices[3] ?? face.indices[2]] as [number, number, number, number],
    face: index,
  }))})
  return bins
}
const emptyBin = binDomain.columns * binDomain.rows
const fullBin = emptyBin + 1
/** Relief height of the rest-pose cat on a regular grid, for warping fragments instead of vertices when the head turns. Outside the head the relief is zero. */
const reliefGrid = {
  minX: -1.6,
  minY: -1.1,
  maxX: 1.6,
  maxY: 1.6,
  columns: 33,
  rows: 28,
} as const
function buildRelief() {
  const values: Array<number> = []
  for (let row = 0;row < reliefGrid.rows;row++) {
    for (let column = 0;column < reliefGrid.columns;column++) {
      const x = reliefGrid.minX + column / (reliefGrid.columns - 1) * (reliefGrid.maxX - reliefGrid.minX)
      const y = reliefGrid.minY + row / (reliefGrid.rows - 1) * (reliefGrid.maxY - reliefGrid.minY)
      let z = 0
      for (const face of catMesh.faces) {
        for (const [a, b, c] of catMesh.triangles(face)) {
          const [pa, pb, pc] = [a, b, c].map(index => catMesh.vertices[index])
          const area = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x)
          const u = ((pb.x - x) * (pc.y - y) - (pb.y - y) * (pc.x - x)) / area
          const v = ((pc.x - x) * (pa.y - y) - (pc.y - y) * (pa.x - x)) / area
          const w = 1 - u - v
          if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) {
            z = u * pa.z + v * pb.z + w * pc.z
          }
        }
      }
      values.push(z)
    }
  }
  return values
}
/** Deterministic build-time randomness in [0, 1) for per-vertex, per-edge and per-face constants. */
function hash(...values: Array<number>) {
  let state = 0x9E_37_79_B9
  for (const value of values) {
    state = Math.imul(state ^ Math.round(value * 1000 + 7919), 0x85_EB_CA_6B)
    state ^= state >>> 13
    state = Math.imul(state, 0xC2_B2_AE_35)
    state ^= state >>> 16
  }
  return (state >>> 0) / 4_294_967_296
}
/** All constant data of the constellation packed into one uniform array of vec4 rows – a single binding, well below the 64 kb limit – with named sections. */
const eyeCorners = new Set(['eyeBottom', 'eyeInner', 'eyeOuter', 'eyeTop'])
const breathingCenter: [number, number] = [0, 0.2]
const eyeCenters = ([-1, 1] as const).map(side => [catMesh.vertices[catMesh.find('eyeInner', side)], catMesh.vertices[catMesh.find('eyeOuter', side)]]).map(([a, b]) => [(a.x + b.x) / 2, (a.y + b.y) / 2])
const eyeDistance = (vertex: CatVertex) => (eyeCorners.has(vertex.name) ? 0 : Math.min(...eyeCenters.map(([x, y]) => Math.hypot(vertex.x - x, vertex.y - y))))
const maxEyeDistance = Math.max(...catMesh.vertices.map(eyeDistance))
/** Normalized distance from the nearest eye: the order in which a reassembling cat lights up, eyes first. */
const keyOf = (vertex: CatVertex) => eyeDistance(vertex) / maxEyeDistance
const brightNames = new Set(['earTip', 'noseTip', 'chin', 'cheek', 'crown'])
const magnitudeOf = (vertex: CatVertex) => (brightNames.has(vertex.name) ? 1 : (eyeCorners.has(vertex.name) ? 0.5 : 0.45 + hash(vertex.index, 1) * 0.35))
/** Vertices with their own little motions: eyelids, ear tips and ear middles. */
const motionCodes: Partial<Record<CatVertex['name'], number>> = {
  eyeTop: 1,
  eyeBottom: 2,
  earTip: 3,
  earMid: 4,
}
const groupTones = {
  cheek: 0.85,
  chin: 1.05,
  ear: 0.9,
  eye: 0,
  forehead: 1,
  innerEar: 0.7,
  muzzle: 1.25,
  nose: 0.8,
}
const bins = buildBins(keyOf)
const tableRows: Array<Vector4> = []
const section = (fill: () => void) => {
  const start = tableRows.length
  fill()
  return start
}
/** four tableRows per vertex: x, y, relief, key · ear morph, cheek morph · side, motion code, magnitude, steady · scatter offset, drift frequencies */
const vertexRows = section(() => {
  for (const vertex of catMesh.vertices) {
    const outward = Math.atan2(vertex.y - breathingCenter[1], vertex.x) + (hash(vertex.index, 2) - 0.5) * 1.6
    const reach = 0.35 + hash(vertex.index, 3) * 0.45
    tableRows.push(new Vector4(vertex.x, vertex.y, vertex.z, keyOf(vertex)), new Vector4(...vertex.ear, ...vertex.chub), new Vector4(vertex.side, motionCodes[vertex.name] ?? 0, magnitudeOf(vertex), eyeCorners.has(vertex.name) ? 1 : 0), new Vector4(Math.cos(outward) * reach, Math.sin(outward) * reach, 0.5 + hash(vertex.index, 10) * 0.4, 0.4 + hash(vertex.index, 12) * 0.4))
  }
})
/** one row per face with its style: tone, blush, shimmer seed */
const styleRows = section(() => {
  for (const [index, face] of catMesh.faces.entries()) {
    tableRows.push(new Vector4(groupTones[face.group], face.group === 'innerEar' || face.group === 'nose' ? 1 : 0, hash(index, 6), 0))
  }
})
/** two tableRows per bin: vertex list start and count, edge list start and count · face list start and count */
const binRows = section(() => {
  for (let index = 0;index < bins.length * 2;index++) {
    tableRows.push(new Vector4)
  }
})
/** one row per bin vertex: its global index */
const binVertexRows = section(() => {
  for (const bin of bins) {
    for (const vertex of bin.vertices) {
      tableRows.push(new Vector4(vertex, 0, 0, 0))
    }
  }
})
/** one row per bin edge: from, to, outline */
const binEdgeRows = section(() => {
  for (const bin of bins) {
    for (const edge of bin.edges) {
      tableRows.push(new Vector4(edge.from, edge.to, edge.outline ? 1 : 0, 0))
    }
  }
})
/** two tableRows per bin face: four corner vertices · face index */
const binFaceRows = section(() => {
  for (const bin of bins) {
    for (const face of bin.faces) {
      tableRows.push(new Vector4(...face.corners), new Vector4(face.face, 0, 0, 0))
    }
  }
})
{ let [vertexAt, edgeAt, faceAt] = [binVertexRows, binEdgeRows, binFaceRows]
  for (const [index, bin] of bins.entries()) {
    tableRows[binRows + index * 2].set(vertexAt, bin.vertices.length, edgeAt, bin.edges.length)
    tableRows[binRows + index * 2 + 1].set(faceAt, bin.faces.length, 0, 0)
    vertexAt += bin.vertices.length
    edgeAt += bin.edges.length
    faceAt += bin.faces.length * 2
  } }
/** the rest-pose relief height on a grid, four samples per row */
const reliefRows = section(() => {
  const values = buildRelief()
  for (let index = 0;index < values.length;index += 4) {
    tableRows.push(new Vector4(values[index], values[index + 1] ?? 0, values[index + 2] ?? 0, values[index + 3] ?? 0))
  }
})
if (tableRows.length * 16 > 60_000) {
  throw new RangeError(`The constellation table needs ${tableRows.length * 16} bytes, more than a uniform buffer holds.`)
}
const table = uniformArray(tableRows, 'vec4')
/** Row `index` (an int node or a constant) of the constellation table. */
function tableRow(index: Node<'int'> | number) {
  return (table as unknown as {element: (at: Node<'int'>) => Node<'vec4'>}).element(typeof index === 'number' ? int(index) : index)
}
const vertexCount = catMesh.vertices.length
type ConstellationInput = {
  /** 0 for far viewers, 1 when the viewer is right in front of this cat */
  closeness: Node<'float'>
  /** position in the dissolve → Cheshire → reassembly cycle, in [0, 1) */
  cycle: Node<'float'>
  /** 1 up close, falling to 0 far away: fine inner lines and whiskers recede so the silhouette carries the figure */
  detail: Node<'float'>
  /** 0 slit pupils, 1 fully dilated; pupils also dilate while the cat is only a pair of eyes in the dark */
  dilation: Node<'float'>
  /** approximate size of a pixel in cat units */
  footprint: Node<'float'>
  /** where the pupils point, roughly within the unit disk */
  gaze: Node<'vec2'>
  /** in-plane head shift per unit of relief height – the head turning toward the viewer */
  look: Node<'vec2'>
  /** fragment position in cat units */
  p: Node<'vec2'>
  /** four independent per-cat random vectors in [0, 1) */
  seeds: [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>, Node<'vec3'>]
  /** 0 awake, 1 soundly asleep */
  sleep: Node<'float'>
  /** unit direction toward the viewer in the cat frame (x right, y up, z out of the surface) */
  viewer: Node<'vec3'>
}

/** Relief height of the rest-pose cat at `point` (cat units), bilinearly interpolated; zero outside the head. */
function reliefAt(point: Node<'vec2'>) {
  const cell = point.sub(vec2(reliefGrid.minX, reliefGrid.minY)).div(vec2((reliefGrid.maxX - reliefGrid.minX) / (reliefGrid.columns - 1), (reliefGrid.maxY - reliefGrid.minY) / (reliefGrid.rows - 1))).clamp(vec2(0), vec2(reliefGrid.columns - 1.001, reliefGrid.rows - 1.001))
  const base = cell.floor()
  const weight = cell.sub(base)
  const sample = (dx: number, dy: number) => {
    const flat = int(base.y.add(dy).mul(reliefGrid.columns).add(base.x.add(dx)))
    const packed = tableRow(flat.div(4).add(reliefRows))
    const lane = flat.mod(4)
    return packed.x.mul(float(lane.equal(0))).add(packed.y.mul(float(lane.equal(1)))).add(packed.z.mul(float(lane.equal(2)))).add(packed.w.mul(float(lane.equal(3))))
  }
  // (TSL’s chained .mix() takes its receiver as the blend factor, so use the function form.)
  return mix(mix(sample(0, 0), sample(1, 0), weight.x), mix(sample(0, 1), sample(1, 1), weight.x), weight.y)
}
/** Energy-conserving anti-aliased core of a line of the given half-width: lines thinner than a pixel dim instead of aliasing. */
function lineCore(distance: Node<'float'>, halfWidth: Node<'float'>, footprint: Node<'float'>) {
  const soft = footprint.mul(0.8).max(0.0005)
  const width = soft.mul(0.6).max(halfWidth)
  return width.sub(distance).div(soft).add(0.5).clamp().mul(halfWidth.div(width))
}
/** A small round star of the given radius that keeps its energy when it shrinks below a pixel. */
function pointStar(distance: Node<'float'>, radius: number, footprint: Node<'float'>) {
  const size = footprint.mul(1.1).max(radius)
  return distance.div(size).pow2().negate().exp().mul(float(radius).div(size).pow2())
}
/** A beaded strand of stardust from `a` to `b`: a hairline (of relative strength `base`) strung with little stars every `spacing` units, each of its own magnitude. `h` is the position along it in [0, 1]. */
function strand(p: Node<'vec2'>, a: Node<'vec2'>, b: Node<'vec2'>, footprint: Node<'float'>, halfWidth: number, spacing: number, base = 0.35) {
  const ab = b.sub(a)
  const length = ab.length().max(0.0001)
  const h = p.sub(a).dot(ab).div(length.pow2()).clamp()
  const distance = p.sub(a.add(ab.mul(h))).length()
  const steps = h.mul(length).div(spacing)
  const index = steps.round()
  const magnitude = index.mul(12.9898).add(length.mul(78.233)).sin().mul(43_758.5453).fract()
  const bead = steps.sub(index).mul(spacing)
  const radius = footprint.max(halfWidth * 2.2).mul(magnitude.mul(0.9).add(0.5))
  const beads = vec2(bead, distance).length().div(radius).pow2().negate().exp().mul(magnitude.mul(1.8).add(0.4))
  return {
    h,
    coverage: lineCore(distance, float(halfWidth), footprint).mul(base).add(beads.mul(float(halfWidth * 2.2).div(footprint.max(halfWidth * 2.2)).pow2())),
  }
}
const Figure = struct({
  head: 'float',
  normal: 'vec3',
  facetShade: 'float',
  facetGlint: 'float',
  blush: 'float',
  lines: 'float',
  glow: 'float',
  purr: 'float',
  pens: 'float',
  stars: 'float',
  halos: 'float',
  iris: 'float',
  irisCore: 'float',
  limbus: 'float',
  pupils: 'float',
  catchlights: 'float',
  eyeGlow: 'float',
  whiskers: 'float',
  earLeft: 'vec2',
  earRight: 'vec2',
})
const index = (name: Parameters<typeof catMesh.find>[0], side: -1 | 0 | 1) => catMesh.find(name, side)
const cross2 = (a: Node<'vec2'>, b: Node<'vec2'>) => a.x.mul(b.y).sub(a.y.mul(b.x))
/** 1 where `value` equals the integer `code`, else 0 */
const is = (value: Node<'float'>, code: number) => step(0.5, value.sub(code).abs()).oneMinus()
/** signed distance from the directed edge a → b, positive on its left (inside a counter-clockwise polygon); degenerate edges never bound */
const sideOf = (p: Node<'vec2'>, a: Node<'vec2'>, b: Node<'vec2'>) => {
  const ab = b.sub(a)
  const length = ab.length()
  return mix(cross2(ab, p.sub(a)).div(length.max(0.0001)), float(64), step(length, 0.0001))
}
/** Time from the start of a cycle at which a reassembling cat has settled completely. */
const settledCycle = 0.036 + 0.1
type Animated = {
  live: Node<'vec2'>
  magnitude: Node<'float'>
  presence: Node<'float'>
  shape: Node<'vec4'>
}
/** what edges and faces need of a vertex: its live position, and relief height and reassembly key in shape.z and shape.w */
type Corner = {
  live: Node<'vec2'>
  shape: Node<'vec4'>
}
/** One living constellation cat, built from the cat mesh. Every vertex is a star that blinks, twitches and turns toward the viewer; every edge is a thread of light; every face is a facet with its own normal. The whole figure periodically dissolves into drifting stardust while its eyes stay behind, then redraws itself from the eyes outward. Performance: breathing and the head turn warp the fragment instead of the vertices, so a settled cat only needs the few mesh elements of the bin the fragment falls into (see catBins.ts). Only cats in the middle of dissolving or reassembling walk the whole mesh. */
function constellation(input: ConstellationInput) {
  const {p: surfacePoint, footprint, look, viewer, gaze, seeds: [s1, s2, s3, s4], cycle, closeness, detail, sleep, dilation} = input
  // --- per-cat life: breathing, blinking, ear twitches
  // Per-cat values are pinned in variables: the loops below would otherwise recompute them for every mesh element.
  const breath = time.mul(1.7).add(s3.x.mul(TAU)).sin().mul(0.014).toVar()
  const blinkPhase = time.div(s3.y.mul(3.2).add(4.1)).add(s3.z).fract()
  const blink = max(blinkPhase.sub(0.5).abs().smoothstep(0, 0.022).oneMinus(), sleep).toVar()
  const twitchPhase = time.div(s2.y.mul(5).add(5.5)).add(s1.x.mul(3.7)).fract()
  const twitch = twitchPhase.mul(13).clamp().mul(TAU).sin().abs().toVar()
  const twitchRight = s3.x.step(0.5).toVar()
  // --- individuality: ear height, cheek fullness, folded ears, eye shape, a head cocked to one side, thread weight (ranges in catBins.ts)
  const earMorph = s2.x.mul(2).sub(0.8).toVar()
  const chubMorph = s1.z.mul(2).sub(0.8).toVar()
  const folded = s4.x.step(0.85).toVar()
  const cock = s4.y.sub(0.5).mul(0.14).toVar()
  const roundEyes = s4.z.sub(0.45).toVar()
  const threads = s4.x.mul(7.31).fract().mul(0.5).add(0.8)
  const lynx = s4.y.mul(5.17).fract().step(0.78)
  // --- dissolve → Cheshire eyes → reassembly
  const assembleRaw = cycle.sub(0.036).div(0.1)
  const assemble = assembleRaw.clamp().toVar()
  const dissolve = cycle.smoothstep(0.003, 0.024).oneMinus().toVar()
  const edgeFade = cycle.smoothstep(0, 0.01).oneMinus()
  const fillOn = max(assembleRaw.smoothstep(0.78, 1), edgeFade)
  const flash = assembleRaw.sub(0.97).div(0.07).pow2().negate().exp()
  const grown = max(assembleRaw.sub(0.8).div(0.2), edgeFade.mul(2)).clamp()
  const scatterTurn = s3.x.mul(TAU)
  const [scatterCos, scatterSin] = [scatterTurn.cos().toVar(), scatterTurn.sin().toVar()]
  // While the figure dissolves every thread fades evenly; while it reassembles, unrevealed parts of a thread are pushed out of reach.
  const dissolving = cycle.step(0.036).oneMinus()
  const lineFade = mix(float(1), edgeFade, dissolving)
  const hiddenReach = dissolving.oneMinus().mul(0.4).toVar()
  // --- the purr: a wave of light radiating from the eyes through the wireframe
  const purr = time.div(s2.z.mul(2.5).add(3.5)).add(s1.y).fract().mul(1.6).sub(0.3).toVar()
  const purrAt = (key: Node<'float'>) => key.sub(purr).div(0.07).pow2().negate().exp()
  /** A vertex of this cat at rest: its individual shape plus blinks and ear twitches. */
  const pose = (vertex: Node<'int'>) => {
    const base = vertex.mul(4).add(vertexRows)
    const shape = tableRow(base)
    const morph = tableRow(base.add(1))
    const info = tableRow(base.add(2))
    const [side, code] = [info.x, info.y]
    const [eyeTop, eyeBottom, earTip, earMid] = [is(code, 1), is(code, 2), is(code, 3), is(code, 4)]
    let position = shape.xy.add(morph.xy.mul(earMorph)).add(morph.zw.mul(chubMorph))
    position = position.add(vec2(0, roundEyes.mul(eyeTop.mul(motions.eyeTopRound).add(eyeBottom.mul(motions.eyeBottomRound)))))
    const fold = vec2(side.mul(motions.foldTip[0]), motions.foldTip[1]).mul(earTip).add(vec2(side.mul(motions.foldMid[0]), motions.foldMid[1]).mul(earMid))
    position = position.add(fold.mul(folded)).add(vec2(cock, cock.mul(side).mul(-0.5)).mul(earTip))
    const twitchSide = mix(twitchRight.oneMinus(), twitchRight, step(0, side))
    position = position.add(vec2(side.mul(motions.twitch[0]), motions.twitch[1]).mul(earTip.add(earMid.mul(motions.twitchMid))).mul(twitch).mul(twitchSide))
    position = vec2(position.x, mix(position.y, eyeTop.sub(eyeBottom).mul(motions.lid).add(motions.blinkTarget), blink.mul(eyeTop.add(eyeBottom))))
    return {
      position,
      shape,
      info,
      base,
    }
  }
  const rest = (vertex: Node<'int'>): Animated => {
    const {position, shape, info} = pose(vertex)
    return {
      live: position,
      presence: float(1),
      shape,
      magnitude: info.z,
    }
  }
  /** A vertex of this cat, fully animated, including dissolving into stardust and flying back: its live position and presence (0 = forgotten, 1 = fully lit). */
  const animate = (vertex: Node<'int'>): Animated => {
    const {position, shape, info, base} = pose(vertex)
    const scatter = tableRow(base.add(3))
    const steady = info.w
    // Forgotten stars drift outward as faint dust until the cat remembers them; the eyes never leave.
    const flight = assemble.sub(shape.w.mul(0.5)).div(0.25).clamp()
    const gather = max(flight.smoothstep(0, 1), dissolve)
    const outward = vec2(scatterCos.mul(scatter.x).sub(scatterSin.mul(scatter.y)), scatterSin.mul(scatter.x).add(scatterCos.mul(scatter.y)))
    const drift = vec2(time.mul(scatter.z).add(float(vertex).mul(2.1)).sin(), time.mul(scatter.w).add(float(vertex).mul(3.7)).cos()).mul(0.06)
    const live = mix(position.add(outward.add(drift).mul(gather.oneMinus())), position, steady)
    const presence = mix(gather.mul(0.84).add(0.16).mul(flight.add(dissolve).mul(4).add(0.6).min(1)), max(assemble.mul(5).clamp(), dissolve), steady)
    return {
      live,
      presence,
      shape,
      magnitude: info.z,
    }
  }
  const figure = Fn(() => { // Undo breathing and the head turn on the fragment: the rest pose is what the tables describe.
    const relaxed = surfacePoint.sub(vec2(...breathingCenter)).div(breath.add(1)).add(vec2(...breathingCenter))
    const p = relaxed.sub(look.mul(reliefAt(relaxed.sub(look.mul(reliefAt(relaxed)))))).toVar()
    const settled = step(settledCycle, cycle)
    const cell = p.sub(vec2(binDomain.minX, binDomain.minY)).div(vec2((binDomain.maxX - binDomain.minX) / binDomain.columns, (binDomain.maxY - binDomain.minY) / binDomain.rows)).floor()
    const inside = step(0, cell.x).mul(step(0, cell.y)).mul(step(cell.x, binDomain.columns - 1)).mul(step(cell.y, binDomain.rows - 1))
    const bin = int(mix(float(fullBin), mix(float(emptyBin), cell.y.mul(binDomain.columns).add(cell.x), inside), settled))
    const header = tableRow(bin.mul(2).add(binRows))
    const faceHeader = tableRow(bin.mul(2).add(binRows).add(1))
    // Shared results of the walks below.
    const bestScore = float(64).toVar()
    const bestOffset = vec2(8).toVar()
    const bestEnergy = float(0).toVar()
    const bestKey = float(0).toVar()
    const bestSeed = float(0).toVar()
    const bestMagnitude = float(0).toVar()
    const halo = float(0).toVar()
    const outline = float(64).toVar()
    const silhouette = float(64).toVar()
    const inner = float(64).toVar()
    const nearest = float(64).toVar()
    const nearestKey = float(0).toVar()
    const pen = float(64).toVar()
    const bestInside = float(-64).toVar()
    const bestNormal = vec3(0, 0, 1).toVar()
    const bestTone = float(1).toVar()
    const bestBlush = float(0).toVar()
    const bestFaceSeed = float(0).toVar()
    /** Walk the bin’s vertices, edges and faces. `vertexAt` animates a vertex for its star; `cornerAt` provides a vertex again for the edges and faces – recomputed for a settled cat (far cheaper on GPUs than a local array indexed at run time), cached for a cat in motion, whose full animation is expensive and whose bin is the whole mesh. */
    const walk = (vertexAt: (vertex: Node<'int'>) => Animated, remember: (vertex: Node<'int'>, animated: Animated) => void, cornerAt: (vertex: Node<'int'>) => Corner, threadsShown: Node<'float'> = float(1), facetsShown: Node<'float'> = float(1)) => { // --- stars: keep the one nearest to the fragment
      Loop({
        start: int(0),
        end: int(header.y),
        type: 'int',
        condition: '<',
      }, ({i}) => {
        const vertex = int(tableRow(int(header.x).add(i)).x)
        const animated = vertexAt(vertex)
        remember(vertex, animated)
        const {live, presence, shape, magnitude} = animated
        const offset = p.sub(live)
        const distance = offset.length()
        const radius = magnitude.mul(0.03)
        const size = footprint.mul(1.1).max(radius)
        const score = distance.div(size)
        // Faint stars would only sparkle as sub-pixel dust from afar.
        const visible = mix(detail.mul(0.8).add(0.2), float(1), step(0.99, magnitude))
        const closer = step(score, bestScore)
        bestOffset.assign(mix(bestOffset, offset, closer))
        bestEnergy.assign(mix(bestEnergy, radius.div(size).pow2().mul(presence).mul(visible), closer))
        bestKey.assign(mix(bestKey, shape.w, closer))
        bestSeed.assign(mix(bestSeed, float(vertex).mul(0.618).fract(), closer))
        bestMagnitude.assign(mix(bestMagnitude, magnitude, closer))
        bestScore.assign(bestScore.min(score))
        // Halos overlap softly, so they are summed rather than taken from the nearest star only.
        halo.addAssign(distance.div(0.1).pow2().negate().exp().mul(presence.pow2()).mul(magnitude))
      })
      // --- threads of light, drawn from their earlier-lit end during reassembly
      If(threadsShown.greaterThan(0.5), () => Loop({
        start: int(0),
        end: int(header.w),
        type: 'int',
        condition: '<',
      }, ({i}) => {
        const edge = tableRow(int(header.z).add(i))
        const from = cornerAt(int(edge.x))
        const to = cornerAt(int(edge.y))
        const a = from.live
        const ab = to.live.sub(a)
        const length = ab.length().max(0.0001)
        const h = p.sub(a).dot(ab).div(length.pow2()).clamp()
        const distance = p.sub(a.add(ab.mul(h))).length()
        const draw = assemble.sub(to.shape.w.mul(0.5)).sub(0.25).div(0.14).clamp()
        const reveal = draw.mul(1.2).sub(h).mul(length).div(0.02).clamp()
        const reach = distance.add(reveal.oneMinus().mul(hiddenReach))
        // The glowing pen tip that draws the thread.
        const tip = p.sub(a.add(ab.mul(draw.mul(1.2).min(1)))).length()
        pen.assign(pen.min(tip.add(draw.mul(draw.oneMinus()).mul(4).oneMinus().mul(8))))
        const isOutline = edge.z
        outline.assign(outline.min(reach.add(isOutline.oneMinus().mul(64))))
        silhouette.assign(silhouette.min(distance.add(isOutline.oneMinus().mul(64))))
        inner.assign(inner.min(reach.add(isOutline.mul(64))))
        nearestKey.assign(mix(nearestKey, mix(from.shape.w, to.shape.w, h), step(reach, nearest)))
        nearest.assign(nearest.min(reach))
      }))
      // --- facets: find the one under the fragment and remember its tilt, tone and blush
      If(facetsShown.greaterThan(0.5), () => Loop({
        start: int(0),
        end: int(faceHeader.y),
        type: 'int',
        condition: '<',
      }, ({i}) => {
        const row = int(faceHeader.x).add(i.mul(2))
        const corners = tableRow(row)
        const [a, b, c, d] = [corners.x, corners.y, corners.z, corners.w].map(value => {
          const corner = cornerAt(int(value))
          return vec3(corner.live, corner.shape.z)
        })
        const insideDistance = sideOf(p, a.xy, b.xy).min(sideOf(p, b.xy, c.xy)).min(sideOf(p, c.xy, d.xy).min(sideOf(p, d.xy, a.xy)))
        // Cross product of the diagonals: the quad’s mean normal, and exactly the triangle normal when d repeats c.
        const tilt = c.sub(a).cross(d.sub(b))
        const style = tableRow(int(tableRow(row.add(1)).x).add(styleRows))
        const better = step(bestInside, insideDistance)
        bestNormal.assign(mix(bestNormal, tilt, better))
        bestTone.assign(mix(bestTone, style.x, better))
        bestBlush.assign(mix(bestBlush, style.y, better))
        bestFaceSeed.assign(mix(bestFaceSeed, style.z, better))
        bestInside.assign(bestInside.max(insideDistance))
      }))
    }
    // A settled cat skips everything about dissolving and reassembling.
    If(settled.greaterThan(0.5), () => walk(rest, () => {}, rest)).Else(() => {
      const cache = array('vec4', vertexCount).toVar()
      const cached = (vertex: Node<'int'>) => (cache as unknown as {element: (at: Node<'int'>) => Node<'vec4'>}).element(vertex)
      // No thread is visible between the moment they fade and the first one being drawn; facets only exist once the figure is filled.
      walk(animate, (vertex, animated) => {
        cached(vertex).assign(vec4(animated.live, animated.shape.zw))
      }, vertex => {
        const corner = cached(vertex)
        return {
          live: corner.xy,
          shape: vec4(0, 0, corner.zw),
        }
      }, step(0.01, cycle).mul(step(cycle, 0.061)).oneMinus(), step(0.001, fillOn))
    })
    // --- threads and stars
    const innerWeight = detail.mul(0.52).add(0.1)
    // From afar the silhouette carries the figure: the outline keeps at least a pixel and a half of width.
    const outlineWidth = threads.mul(0.013).max(footprint.mul(detail.oneMinus().mul(0.75)))
    const lines = lineCore(outline, outlineWidth, footprint).max(lineCore(inner, threads.mul(0.0085), footprint).mul(innerWeight)).mul(lineFade)
    const glow = outline.div(0.075).pow2().negate().exp().max(inner.div(0.075).pow2().negate().exp().mul(innerWeight)).mul(lineFade)
    const purrLight = purrAt(nearestKey).mul(nearest.div(0.035).pow2().negate().exp()).mul(lineFade)
    const pens = pen.div(0.05).pow2().negate().exp()
    const twinkle = time.mul(bestSeed.mul(2.2).add(1.3)).add(s1.x.mul(TAU)).add(bestSeed.mul(47.3)).sin().mul(0.18).add(0.86)
    const starEnergy = bestEnergy.mul(twinkle).mul(purrAt(bestKey).mul(1.4).add(1))
    // Only the brightest stars of each figure carry diffraction spikes, and only for a close look.
    const spikeWidth = footprint.mul(0.7).max(0.0035)
    const [spikeX, spikeY] = [bestOffset.x.abs(), bestOffset.y.abs()]
    const spikes = spikeX.div(spikeWidth).add(spikeY.div(0.085)).negate().exp().add(spikeY.div(spikeWidth).add(spikeX.div(0.085)).negate().exp()).mul(float(0.0035).div(spikeWidth)).mul(closeness).mul(0.55).mul(step(0.99, bestMagnitude))
      // Spikes fade out before the bin margin (catBins.ts starReach) so no bin border can clip them.
      .mul(spikeX.max(spikeY).smoothstep(0.14, 0.27).oneMinus())
    const stars = bestScore.pow2().mul(-2.6).exp().add(spikes).mul(starEnergy)
    const halos = halo.mul(detail.mul(0.6).add(0.4))
    // --- facets: inside any facet the head is solid; only the true silhouette is anti-aliased
    const soft = footprint.mul(0.6).max(0.0005)
    const head = silhouette.mul(step(0, bestInside).mul(2).sub(1)).div(soft).add(0.5).clamp()
    const normal = bestNormal.normalize()
    const shimmer = time.mul(bestFaceSeed.mul(0.5).add(0.45)).add(bestFaceSeed.mul(TAU * 7)).add(s2.x.mul(TAU)).sin().mul(0.22).add(0.78)
    const tone = s1.x.mul(5.31).add(bestFaceSeed.mul(3.7)).fract().mul(0.5).add(0.5)
    const facetShade = head.mul(tone).mul(shimmer).mul(bestTone)
    // A virtual star light slowly circles each cat; facets flash when they mirror it toward the viewer.
    const lightTurn = time.mul(0.23).add(s2.x.mul(TAU))
    const mirror = vec3(lightTurn.cos().mul(0.55), lightTurn.sin().mul(0.55), 1).normalize().add(viewer).normalize()
    const facetGlint = head.mul(normal.dot(mirror).clamp().pow(40)).mul(bestTone).mul(fillOn)
    // --- eyes: glowing irises with slit pupils that follow the viewer; evaluated only near the eyes. Eye corners never scatter, and whiskers and threads
    // are hidden while a cat is in motion, so the rest pose serves all of these.
    const iris = float(0).toVar()
    const irisCore = float(0).toVar()
    const pupils = float(0).toVar()
    const catchlights = float(0).toVar()
    const limbus = float(0).toVar()
    const eyeGlow = float(0).toVar()
    const pupilOpen = mix(float(0.09), float(0.52), max(dilation, fillOn.oneMinus()))
    If(p.x.abs().lessThan(1.3).and(p.y.sub(0.05).abs().lessThan(0.75)), () => {
      for (const side of [-1, 1] as const) {
        const [innerCorner, top, outerCorner, bottom] = (['eyeInner', 'eyeTop', 'eyeOuter', 'eyeBottom'] as const).map(name => rest(int(index(name, side))).live)
        // The eye quad in counter-clockwise order for this side.
        const ring = side === 1 ? [innerCorner, bottom, outerCorner, top] : [innerCorner, top, outerCorner, bottom]
        const mask = sideOf(p, ring[0], ring[1]).min(sideOf(p, ring[1], ring[2])).min(sideOf(p, ring[2], ring[3]).min(sideOf(p, ring[3], ring[0]))).div(soft).add(0.5).clamp()
        const center = innerCorner.add(outerCorner).mul(0.5)
        const halfWidth = outerCorner.x.sub(innerCorner.x).abs().mul(0.5)
        const halfHeight = top.y.sub(bottom.y).mul(0.5).max(0.004)
        const pupilCenter = center.add(gaze.mul(vec2(halfWidth.mul(0.38), halfHeight.mul(0.3))))
        const local = p.sub(pupilCenter)
        const radial = local.div(vec2(halfWidth, halfHeight)).length()
        const pupilWidth = halfWidth.mul(pupilOpen)
        const pupilDistance = local.div(vec2(pupilWidth, halfHeight.mul(0.92))).length()
        const pupilEdge = footprint.div(pupilWidth).max(0.04)
        eyeGlow.addAssign(p.sub(center).div(vec2(halfWidth, halfHeight.max(0.06))).length().div(1.6).pow2().negate().exp().mul(halfHeight.div(0.185).clamp()))
        iris.addAssign(mask.mul(radial.oneMinus().mul(0.75).add(0.55)))
        irisCore.addAssign(mask.mul(radial.oneMinus().clamp().pow(3)))
        limbus.addAssign(mask.mul(radial.smoothstep(0.55, 1.05)))
        pupils.addAssign(mask.mul(pupilDistance.smoothstep(pupilEdge.oneMinus(), pupilEdge.add(1)).oneMinus()))
        const glint = p.sub(pupilCenter.add(vec2(halfWidth.mul(-0.32 * side), halfHeight.mul(0.42)))).length()
        const spark = p.sub(pupilCenter.add(vec2(halfWidth.mul(0.28 * side), halfHeight.mul(-0.38)))).length()
        catchlights.addAssign(mask.mul(glint.div(footprint.max(0.034)).pow2().negate().exp().add(spark.div(footprint.max(0.016)).pow2().negate().exp().mul(0.5))))
      }
    })
    // --- whiskers: tapered hairlines that sway, each tipped with a small star; lynx tufts above the ears of a few cats
    const whiskers = float(0).toVar()
    const [padLeft, padRight] = ([-1, 1] as const).map(side => {
      const padIndex = index('whiskerPad', side)
      return rest(int(padIndex)).live.sub(vec2(catMesh.vertices[padIndex].x, catMesh.vertices[padIndex].y))
    })
    If(p.y.lessThan(0.1).and(p.x.abs().greaterThan(0.2)), () => {
      for (const [number, whisker] of catMesh.whiskers.entries()) {
        const pad = whisker.side === -1 ? padLeft : padRight
        const root = vec2(...whisker.from).add(pad)
        const sway = time.mul(1.1 + hash(number, 9) * 0.6).add(s2.y.mul(TAU)).add(number).sin().mul(0.03)
        const tip = vec2(...whisker.to).add(vec2(0, sway)).add(look.mul(0.25)).add(pad.mul(0.5))
        const ab = tip.sub(root)
        const h = p.sub(root).dot(ab).div(ab.dot(ab)).clamp()
        const distance = p.sub(root.add(ab.mul(h))).length()
        const hair = lineCore(distance, h.oneMinus().mul(0.6).add(0.4).mul(0.0045), footprint).mul(h.smoothstep(0.16, 0.4))
        whiskers.assign(whiskers.max(hair.add(pointStar(p.sub(tip).length(), 0.016, footprint).mul(1.5)).mul(grown.mul(1.25).sub(h).div(0.08).clamp())))
      }
    })
    const [earLeft, earRight] = ([-1, 1] as const).map(side => rest(int(index('earTip', side))).live)
    If(p.y.greaterThan(0.5).and(lynx.greaterThan(0.5)), () => {
      for (const [side, earTip] of [[-1, earLeft], [1, earRight]] as const) {
        const end = earTip.add(vec2(side * 0.05, 0.24))
        const ab = end.sub(earTip)
        const h = p.sub(earTip).dot(ab).div(ab.dot(ab)).clamp()
        const distance = p.sub(earTip.add(ab.mul(h))).length()
        whiskers.assign(whiskers.max(lineCore(distance, float(0.004), footprint).mul(h.smoothstep(0.2, 0.45)).add(pointStar(p.sub(end).length(), 0.018, footprint).mul(1.6)).mul(grown)))
      }
    })
    // Ear tips in the fragment’s (surface) space, for the threads tying cats together outside of this function.
    const surfaceEar = (ear: Node<'vec2'>) => ear.sub(vec2(...breathingCenter)).mul(breath.add(1)).add(vec2(...breathingCenter)).add(look.mul(catMesh.vertices[index('earTip', 1)].z))
    return Figure(head, normal.mul(head).add(vec3(0, 0, head.oneMinus())), facetShade, facetGlint, head.mul(bestBlush), lines, glow, purrLight, pens, stars, halos, iris, irisCore, limbus, pupils.clamp(), catchlights, eyeGlow, whiskers.mul(detail.mul(0.8).add(0.2)), surfaceEar(earLeft), surfaceEar(earRight))
  })()
  const get = <Type extends 'float' | 'vec2' | 'vec3'>(name: string) => figure.get(name) as unknown as Node<Type>
  return {
    head: get<'float'>('head'),
    normal: get<'vec3'>('normal'),
    facetShade: get<'float'>('facetShade'),
    facetGlint: get<'float'>('facetGlint'),
    blush: get<'float'>('blush'),
    lines: get<'float'>('lines'),
    glow: get<'float'>('glow'),
    purr: get<'float'>('purr'),
    pens: get<'float'>('pens'),
    stars: get<'float'>('stars'),
    halos: get<'float'>('halos'),
    iris: get<'float'>('iris'),
    irisCore: get<'float'>('irisCore'),
    limbus: get<'float'>('limbus'),
    pupils: get<'float'>('pupils'),
    catchlights: get<'float'>('catchlights'),
    eyeGlow: get<'float'>('eyeGlow'),
    whiskers: get<'float'>('whiskers'),
    fillOn,
    /** threads toward the neighbors grow with the whiskers */
    grown,
    /** live ear tips, where the threads to the neighboring cats are tied */
    ears: {
      left: get<'vec2'>('earLeft'),
      right: get<'vec2'>('earRight'),
    },
    flash,
    blink,
  }
}
const lamps = [[0.35, 0.78, 0.52], [-0.62, 0.28, 0.73], [0.1, -0.35, 0.93]] as const
/** Sparse metal flakes suspended in the lacquer, like maki-e gold dust. Each flake has its own tilt and flashes only when it mirrors one of three fixed view-space lamps toward the viewer, so the field twinkles as you walk past. Flakes smaller than a pixel fade instead of aliasing. `normal` is in object space; `density` is the fraction of lattice cells holding a flake. */
function flakes(p: Node<'vec3'>, normal: Node<'vec3'>, scale: number, density: number) {
  const q = p.mul(scale)
  const cell = q.floor()
  const random = cellNoiseVec3(cell.add(113)).toVar()
  const tilt = cellNoiseVec3(cell.add(227)).sub(0.5)
  const distance = q.fract().sub(random.mul(0.5).add(0.25)).length()
  const footprint = q.fwidth().length().max(0.001)
  const radius = footprint.mul(0.8).max(0.12)
  const core = distance.div(radius).pow2().mul(-3).exp().mul(radius.reciprocal().mul(0.12).pow2())
  const present = random.z.step(density).oneMinus().mul(footprint.smoothstep(0.4, 1.4).oneMinus())
  const flakeNormal = transformNormalToView(normal.add(tilt.mul(1.3)).normalize())
  let flash: Node<'float'> | undefined
  for (const lamp of lamps) {
    const value = flakeNormal.dot(vec3(...lamp).normalize().add(positionViewDirection).normalize()).clamp().pow(90)
    flash = flash ? flash.add(value) : value
  }
  return core.mul(present).mul(flash!)
}
/** Exhibition knot constants: tube radius, the centerline’s total length and the parameter span of uv.x. */
const tubeRadius = 0.13
const knotLength = 7.1772
const parameterSpan = TAU * 2
type CellLayout = {
  columns: number
  rows: number
}
/** Surface point of the torus-knot tube exactly as TorusKnotGeometry places it, for a curve parameter and an angle around the tube. */
function tubePoint(t: Node<'float'>, angle: Node<'float'>) {
  const center = knotCurve(t)
  const ahead = knotCurve(t.add(0.01))
  const tangent = ahead.sub(center)
  const binormal = tangent.cross(ahead.add(center)).normalize()
  const normal = binormal.cross(tangent).normalize()
  const outward = normal.mul(angle.cos().negate()).add(binormal.mul(angle.sin()))
  return {
    center,
    normal,
    binormal,
    outward,
    position: center.add(outward.mul(tubeRadius)),
  }
}
/** Object-space surface frame of the knot for a uv coordinate, independent of vertex tangents and screen derivatives: `along` follows +u, `around` follows +v, `outward` is the tube normal. `stretch` is the local surface speed along u relative to its mean, i.e. how much the uv grid is stretched on the outside of bends (> 1) or squeezed on the inside (< 1). */
function tubeFrame(tube: Node<'vec2'>) {
  const angle = tube.y.mul(TAU)
  const here = tubePoint(tube.x.mul(parameterSpan), angle)
  const {velocity, stretch} = surfaceVelocity(tube)
  const around = here.normal.mul(angle.sin()).add(here.binormal.mul(angle.cos())).normalize()
  return {
    along: velocity.normalize(),
    around,
    outward: vec3(here.outward),
    stretch,
  }
}
function surfaceVelocity(tube: Node<'vec2'>) {
  const t = tube.x.mul(parameterSpan)
  const angle = tube.y.mul(TAU)
  const delta = 0.002
  const velocity = tubePoint(t.add(delta), angle).position.sub(tubePoint(t.sub(delta), angle).position)
  return {
    velocity,
    stretch: velocity.length().div(delta * 2).mul(parameterSpan / knotLength),
  }
}
/** tubeFrame evaluated per vertex and interpolated: the frame varies slowly across the dense knot mesh, so this is exact enough and far cheaper than evaluating it per fragment. */
function interpolatedTubeFrame(tube: Node<'vec2'>) {
  const frame = tubeFrame(tube)
  return {
    along: varying(frame.along).normalize(),
    around: varying(frame.around).normalize(),
    outward: varying(frame.outward).normalize(),
    stretch: varying(frame.stretch),
  }
}
/** The exhibition knot’s centerline, identical to lib/knotCurve.ts. */
function curve(t: number): Vector {
  const phase = t * 1.5
  const radius = (Math.cos(phase) + 2) * 0.225
  return [radius * Math.cos(t), radius * Math.sin(t), Math.sin(phase) * 0.225]
}
/** CPU twin of tubeFrame.ts: surface point and frame at a uv coordinate. */
function surface(u: number, v: number) {
  const t = u * parameterSpan
  const angle = v * TAU
  const point = (at: number) => {
    const center = curve(at)
    const ahead = curve(at + 0.01)
    const tangent = sub(ahead, center)
    const binormal = normalize(cross(tangent, add(ahead, center)))
    const normal = normalize(cross(binormal, tangent))
    return {
      normal,
      binormal,
      position: add(center, add(scaleVector(normal, -Math.cos(angle) * tubeRadius), scaleVector(binormal, Math.sin(angle) * tubeRadius))),
    }
  }
  const here = point(t)
  const delta = 0.002
  const velocity = sub(point(t + delta).position, point(t - delta).position)
  return {
    along: normalize(velocity),
    around: normalize(add(scaleVector(here.normal, Math.sin(angle)), scaleVector(here.binormal, Math.cos(angle)))),
    stretch: vectorLength(velocity) / (delta * 2) * parameterSpan / knotLength,
  }
}
/** Per-cell constants of the cat lattice, computed once on the CPU instead of for every fragment: the tube frame at the cell center (for sitting cats upright), the tightest stretch across the cell (for shrinking cats in bends) and the two knots on the cell’s side borders where the threads to the neighbors are tied. */
function cellTables({columns, rows}: CellLayout) {
  const frames: Array<{
    along: Vector
    around: Vector
    tightest: number
  }> = []
  const knots: Array<[number, number, number, number]> = []
  const knotAt = (border: number, row: number) => {
    const wrapped = (border % columns + columns) % columns
    const height = hash(wrapped, row, 71) * 0.5 + 0.3
    const u = (border + row / rows) / columns
    const v = (row + 0.5 - height * 0.5) / rows
    return [height, surface(u, v).stretch] as const
  }
  for (let row = 0;row < rows;row++) {
    for (let column = 0;column < columns;column++) {
      const u = (column + row / rows + 0.5) / columns
      const v = (row + 0.5) / rows
      const center = surface(u, v)
      const tightest = Math.min(center.stretch, surface(u, v - 0.4 / rows).stretch, surface(u, v + 0.4 / rows).stretch)
      frames.push({
        along: center.along,
        around: center.around,
        tightest,
      })
      knots.push([...knotAt(column, row), ...knotAt(column + 1, row)])
    }
  }
  return {
    frames,
    knots,
  }
}
/** The cell tables as a uniform array: three rows per cell (along + tightest stretch, around, both knots’ height and stretch). */
function cellTableNode(layout: CellLayout) {
  const {frames, knots} = cellTables(layout)
  const rows = frames.flatMap((frame, cellIndex) => [new Vector4(...frame.along, frame.tightest), new Vector4(...frame.around, 0), new Vector4(...knots[cellIndex])])
  const cellTable = uniformArray(rows, 'vec4') as unknown as {element: (at: Node<'int'>) => Node<'vec4'>}
  return (cell: Node<'float'>, row: 0 | 1 | 2) => cellTable.element(int(cell).mul(3).add(row))
}
/** Seconds between two meteors on the same lane, per lane, and the fraction of that period a meteor is in flight. */
const periods = [9.7, 12.3, 8.1, 14.9] as const
const flightShare = 0.3
/** How far along the knot (in uv.x) a meteor travels during its flight. */
const reach = 0.45
/** A layer of point stars that sits `depth` object units beneath the lacquer, so it slides against the surface as the viewer moves. */
function starLayer(p: Node<'vec3'>, view: Node<'vec3'>, depth: number, frequency: number, threshold: number, seed: number) {
  const q = p.sub(view.mul(depth)).mul(frequency).add(seed)
  const cell = q.floor()
  const random = cellNoiseVec3(cell).toVar()
  const identity = cellNoiseVec3(cell.add(71.3)).toVar()
  const distance = q.fract().sub(random.mul(0.6).add(0.2)).length()
  const footprint = q.fwidth().length().max(0.001)
  const radius = footprint.mul(0.9).max(0.05)
  const energy = radius.reciprocal().mul(0.05).pow2().mul(footprint.smoothstep(0.35, 1.3).oneMinus())
  const core = distance.div(radius).pow2().mul(-3).exp()
  const gate = identity.x.smoothstep(threshold, threshold + 0.004)
  const twinkle = time.mul(identity.y.mul(3).add(1.2)).add(identity.z.mul(40)).sin().mul(0.3).add(0.75)
  const tint = mix(color(hsl.integer(71, 100, 88.6)), color(hsl.integer(262, 100, 80)), identity.z)
  return tint.mul(core.mul(gate).mul(twinkle).mul(energy).mul(identity.y.mul(0.7).add(0.3)))
}
/** Deep lacquered night: a slow nebula and two parallax star layers suspended inside the tube. */
function nightSky(p: Node<'vec3'>, view: Node<'vec3'>) {
  const drift = vec3(time.mul(0.006), time.mul(-0.004), time.mul(0.005))
  const nebulaPoint = p.sub(view.mul(0.09)).add(drift)
  const warp = mx_noise_float(nebulaPoint.mul(1.7)).mul(0.6).toVar()
  const cloud = mx_fractal_noise_float(nebulaPoint.mul(2.4).add(warp), 3, 2.1, 0.5).mul(0.5).add(0.5).toVar()
  const filament = mx_fractal_noise_float(nebulaPoint.mul(5.2).sub(warp), 2, 2.2, 0.55).mul(0.5).add(0.5).toVar()
  const hue = mx_noise_float(nebulaPoint.mul(0.9).add(3.1)).mul(0.5).add(0.5)
  const nebulaTint = mix(mix(color(hsl.integer(291, 86, 16.4)), color(hsl.integer(237, 81, 25)), hue.smoothstep(0.3, 0.7)), color(hsl.integer(342, 76, 23)), filament.smoothstep(0.62, 0.85).mul(0.6))
  const density = cloud.smoothstep(0.38, 0.82).mul(filament.mul(0.6).add(0.4)).toVar()
  // Outside the figures only the brightest filaments survive, so the lacquer stays black.
  const nebula = nebulaTint.mul(density.smoothstep(0.35, 0.95).mul(filament.smoothstep(0.5, 0.8)).mul(0.07).add(0.002))
  const stars = starLayer(p, view, 0.035, 95, 0.86, 0).mul(1.6).add(starLayer(p, view, 0.085, 170, 0.9, 13).mul(1.1))
  return {
    nebula,
    density,
    stars,
    /** a far denser field for the inside of the figures – every cat carries a galaxy */
    galaxy: starLayer(p, view, 0.055, 230, 0.62, 29).mul(1.3),
  }
}
/** Shooting stars that streak along the lanes between the rows of cats. Lane k runs along uv.y = k / lanes; each lane launches its own meteor every few seconds at a new place. `head(k)` gives where a lane’s meteor is (in uv) and how visible it is, so the cats can turn to watch it. */
class Meteors {
  constructor(readonly lanes: number) {
    if (lanes > periods.length) {
      throw new RangeError(`At most ${periods.length} meteor lanes are supported.`)
    }
  }
  /** uv position of the meteor head on lane `k` (a float node holding an integer) and its brightness in [0, 1] */
  head(k: Node<'float'>) {
    let period: Node<'float'> = float(periods[0])
    for (let lane = 1;lane < this.lanes;lane++) {
      period = k.greaterThan(lane - 0.5).select(float(periods[lane]), period)
    }
    const cycle = time.div(period).add(k.mul(0.37))
    const launch = cycle.floor()
    const phase = cycle.fract().div(flightShare)
    const start = launch.mul(0.618).add(k.mul(0.29)).fract()
    const direction = launch.mul(1.7).add(k).mod(2).lessThan(1).select(float(1), float(-1))
    const progress = phase.clamp()
    const u = start.add(progress.mul(reach).mul(direction)).fract()
    // Meteors flare up, then burn out before they reach the end of their flight.
    const brightness = phase.smoothstep(0, 0.08).mul(phase.smoothstep(0.7, 1).oneMinus()).mul(phase.lessThan(1).select(float(1), float(0)))
    return {
      uv: vec2(u, k.div(this.lanes)),
      direction,
      brightness,
    }
  }
  /** Light of the meteor on the nearest lane at `tube` (uv). `tubeLength` and `circumference` convert uv to object units; `footprint` is the size of a pixel in object units. */
  light(tube: Node<'vec2'>, tubeLength: number, circumference: number, footprint: Node<'float'>) {
    const k = tube.y.mul(this.lanes).round()
    const {uv: headUv, direction, brightness} = this.head(k.mod(this.lanes))
    const along = tube.x.sub(headUv.x).add(0.5).fract().sub(0.5).mul(tubeLength).mul(direction)
    const across = tube.y.sub(k.div(this.lanes)).mul(circumference)
    const width = footprint.mul(0.8).max(0.0022)
    const energy = float(0.0022).div(width)
    // A hot head and a tail that thins and cools behind it.
    const behind = along.negate().max(0)
    const tail = behind.div(0.5).oneMinus().clamp().pow(1.5).mul(along.lessThan(0.004).select(float(1), float(0)))
    const core = across.div(width.mul(behind.mul(1.5).add(1))).pow2().negate().exp().mul(energy)
    const head = vec2(along, across).length().div(width.mul(2.2)).pow2().negate().exp().mul(energy)
    const glow = vec2(along.mul(0.5), across).length().div(0.03).pow2().negate().exp().mul(0.12)
    return {
      head: head.add(glow).mul(brightness),
      tail: core.mul(tail).mul(brightness),
    }
  }
}
/** Cats per ring around the tube and along the whole knot; each row is shifted by a third of a cell, forming a seamless helix. */
const rows = 3
const columns = 18
const cellWidth = knotLength / columns
const cellHeight = TAU * tubeRadius / rows
/** Object units per cat unit for a full-grown cat; cats in tight bends shrink to fit (kittens huddle on the insides of curves). */
const catScale = 0.105
/** Half the width of a cat including whiskers and half its height including lynx tufts, in cat units. */
const catHalfWidth = 1.32
const catHalfHeight = 1.1
/** Depth of the figures beneath the lacquer surface, in object units. */
const figureDepth = 0.008
const catCenterY = 0.23
/** Seconds for a full dissolve → reassembly → life cycle; every cat keeps its own schedule. */
const cyclePeriod = 48
/** Felis Major – a sky of low-poly cats drawn in starlight on black lacquer. Each cat is a constellation of stars joined by threads into triangles and quads, with faceted glass between them that opens onto a denser, breed-tinted nebula. The cats breathe, blink, twitch their ears, purr waves of light through their wireframes and turn their heads and pupils toward the viewer; sleeping ones wake when approached. Shooting stars streak along the lanes between the rows and every cat nearby turns to watch. Now and then a cat dissolves into drifting stardust, leaves only its eyes hanging in the dark, then redraws itself line by line from the eyes outward. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {p, view, facing, grazing} = viewerFrame()
    const tube = uv()
    const frame = interpolatedTubeFrame(tube)
    const distance = positionView.length()
    const closeness = distance.smoothstep(0.75, 2.6).oneMinus()
    const far = distance.smoothstep(2.1, 4)
    // --- which cat, and where inside it
    const q = tube.mul(vec2(columns, rows))
    const row = q.y.floor()
    const shifted = q.x.sub(row.div(rows))
    const column = shifted.floor()
    const id = vec2(column.add(columns).mod(columns), row.mod(rows))
    // Hash calls are emitted wherever a node is used, so every widely shared value is pinned in a shader variable.
    const seeds = [3, 17, 41, 59].map(salt => cellNoiseVec3(vec3(id, salt)).toVar()) as unknown as [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>, Node<'vec3'>]
    const [s1, s2, s3] = seeds
    // Undo the uv stretch around bends so every cat keeps true proportions; where its cell is squeezed, the whole cat shrinks instead.
    const cellU = column.add(row.div(rows)).add(0.5).div(columns)
    const cellV = row.add(0.5).div(rows)
    const cellData = cellTableNode({
      columns,
      rows,
    })
    const cellIndex = id.y.mul(columns).add(id.x)
    const centerAlong = cellData(cellIndex, 0)
    const center = {
      along: centerAlong.xyz,
      around: cellData(cellIndex, 1).xyz,
    }
    const tightest = centerAlong.w
    const knots = cellData(cellIndex, 2)
    const cellScale = vec2(frame.stretch.mul(cellWidth / catScale), cellHeight / catScale)
    // Cat “up” runs along −v; the cell frame is (along, up, outward).
    const up = frame.around.negate()
    const raw = vec2(shifted.sub(column).sub(0.5), q.y.sub(row).sub(0.5).negate()).mul(cellScale)
    const bounds = cellScale.mul(0.5).sub(raw.abs())
    const window = bounds.x.smoothstep(0, 0.16).mul(bounds.y.smoothstep(0, 0.16))
    // Wherever the tube faces sideways, cats sit upright in the room: their ears turn toward world up. On the tube’s top and bottom, where “up” has no direction on the surface, they keep a random pose.
    const worldUp = modelWorldMatrixInverse.mul(vec4(0, 1, 0, 0)).xyz.normalize()
    const upOnSurface = vec2(worldUp.dot(center.along), worldUp.dot(center.around.negate()))
    const upright = mx_atan2(upOnSurface.x.negate(), upOnSurface.y) as unknown as Node<'float'>
    const settled = upOnSurface.length().smoothstep(0.2, 0.55)
    const pose = mix(s1.y.sub(0.5).mul(0.6), upright.add(s1.y.sub(0.5).mul(0.24)), settled)
    const tilt = pose.add(time.mul(0.37).add(s2.y.mul(TAU)).sin().mul(0.035))
    const [poseCos, poseSin] = [pose.cos().abs(), pose.sin().abs()]
    const fitAlong = tightest.mul(cellWidth / 2 / catScale).div(poseCos.mul(catHalfWidth).add(poseSin.mul(catHalfHeight)))
    const fitAround = float(cellHeight / 2 / catScale).div(poseSin.mul(catHalfWidth).add(poseCos.mul(catHalfHeight)))
    const size = s3.z.mul(0.18).add(0.82).mul(fitAlong.min(fitAround).min(1))
    const offset = vec2(s1.x.sub(0.5).mul(0.12), s2.z.sub(0.5).mul(0.08))
    const [cosTilt, sinTilt] = [tilt.cos(), tilt.sin()]
    const rotateIn = (v: Node<'vec2'>) => vec2(v.x.mul(cosTilt).add(v.y.mul(sinTilt)), v.y.mul(cosTilt).sub(v.x.mul(sinTilt)))
    const rotateOut = (v: Node<'vec2'>) => vec2(v.x.mul(cosTilt).sub(v.y.mul(sinTilt)), v.y.mul(cosTilt).add(v.x.mul(sinTilt)))
    // --- the viewer: head turn, gaze, attention, sleep
    const tangentView = vec2(view.dot(frame.along), view.dot(up))
    const normalView = view.dot(frame.outward).max(0.3)
    const lean = rotateIn(tangentView.div(normalView))
    const leanLength = lean.length()
    const towardViewer = lean.mul(leanLength.min(1.6).div(leanLength.max(0.0001)))
    // The figures float a hair beneath the lacquer, so they slide against its reflections as the viewer moves.
    const toCat = (point: Node<'vec2'>) => rotateIn(point.sub(offset)).div(size).add(vec2(0, catCenterY))
    const catPoint = toCat(raw).sub(lean.mul(figureDepth / catScale).div(size))
    // Differentiate the continuous lattice coordinates, not the per-cell ones, so the footprint stays small across cell borders.
    const footprint = vec2(shifted, q.y).fwidth().mul(cellScale).length().mul(0.7).div(size)
    const wander = vec2(time.mul(0.29).add(s3.y.mul(TAU)).sin(), time.mul(0.41).add(s1.z.mul(TAU)).sin().mul(0.6))
    const sleepy = s2.x.step(0.14).oneMinus()
    const sleep = sleepy.mul(distance.smoothstep(1.05, 1.6))
    const curiosity = s3.y.mul(0.25).add(0.3).mul(closeness.mul(0.5).add(0.7)).mul(sleep.mul(0.75).oneMinus())
    // Pupils snap toward the viewer much more eagerly than the head follows.
    // --- shooting stars along the lanes between the rows; the cats on either side watch them pass
    const meteors = new Meteors(rows)
    const watch = (lane: Node<'float'>) => {
      const {uv: head, brightness} = meteors.head(lane.mod(rows))
      const along = head.x.sub(cellU).add(0.5).fract().sub(0.5).mul(knotLength / catScale)
      const across = lane.div(rows).sub(cellV).mul(TAU * tubeRadius / catScale).negate()
      const toward = rotateIn(vec2(along, across).sub(offset)).div(size).sub(vec2(0, catCenterY))
      const meteorDistance = toward.length().max(0.0001)
      return {
        direction: toward.div(meteorDistance),
        attention: brightness.mul(meteorDistance.smoothstep(7, 2.5)),
      }
    }
    const [above, below] = [watch(row), watch(row.add(1))]
    const meteorAttention = above.attention.max(below.attention).mul(sleep.oneMinus())
    const pull = above.direction.mul(above.attention).add(below.direction.mul(below.attention))
    const meteorDirection = pull.div(pull.length().max(0.0001))
    const gazeRaw = mix(towardViewer.mul(2.6).add(wander.mul(0.2)), meteorDirection.mul(1.6), meteorAttention)
    const gaze = gazeRaw.div(gazeRaw.length().max(1))
    const look = mix(towardViewer.add(wander.mul(0.35)), meteorDirection.mul(0.9), meteorAttention).mul(curiosity)
    const cycle = time.div(cyclePeriod).add(s3.z).add(s1.y.mul(0.37)).fract()
    const cat = constellation({
      p: catPoint,
      footprint,
      look,
      viewer: vec3(rotateIn(tangentView), view.dot(frame.outward)).normalize(),
      gaze,
      seeds,
      cycle,
      closeness,
      detail: far.oneMinus(),
      sleep,
      dilation: closeness.pow(1.5),
    })
    // --- the sky behind and inside the figures
    const sky = nightSky(p, view)
    const palette = breedPalette(s1.z.mul(breeds.length).floor().min(breeds.length - 1))
    const head = cat.head.mul(window)
    const shownFill = head.mul(cat.fillOn)
    // --- emission
    const lineLight = cat.lines.mul(2).add(cat.glow.mul(0.1)).mul(far.mul(0.9).add(1))
    // Facets are windows into a denser, breed-tinted nebula.
    const fillLight = palette.fill.mul(cat.facetShade).mul(sky.density.mul(0.14).add(0.035).add(far.mul(0.4)).add(cat.flash.mul(0.9))).mul(cat.fillOn)
    const blushLight = palette.blush.mul(cat.blush).mul(cat.fillOn).mul(sky.density.mul(0.2).add(0.12))
    const eyeLight = closeness.mul(0.8).add(1.1).add(far.mul(1.2))
    const irisLight = mix(palette.iris, color(hsl.integer(93, 100, 96)), cat.irisCore.mul(0.45)).mul(cat.iris.mul(1.3).add(cat.irisCore.mul(1.6))).mul(cat.limbus.mul(0.6).oneMinus()).mul(cat.pupils.mul(0.95).oneMinus()).mul(eyeLight)
    const eyeBeacon = cat.eyeGlow.mul(far.mul(0.4).add(0.12)).mul(cat.fillOn.mul(0.5).add(0.5))
    // Each figure pools a little of its own light on the lacquer around it.
    const aura = catPoint.sub(vec2(0, 0.2)).length().div(1.15).pow2().negate().exp().mul(0.04).mul(cat.fillOn)
    const figure = palette.line.mul(lineLight)
      .add(mix(palette.line, color(hsl.integer(0, 0, 100)), 0.55).mul(cat.purr.mul(1.8)))
      .add(palette.star.mul(cat.stars.mul(4.5).add(cat.halos.mul(0.12))))
      .add(color(hsl.integer(0, 0, 100)).mul(cat.pens.mul(3.5)))
      .add(fillLight.add(blushLight).mul(cat.head))
      .add(irisLight)
      .add(palette.iris.mul(eyeBeacon))
      .add(color(hsl.integer(0, 0, 100)).mul(cat.catchlights.mul(3)))
      .add(palette.star.mul(cat.whiskers.mul(1.6)))
      .add(palette.star.mul(cat.facetGlint.mul(0.5)))
      .add(palette.fill.mul(aura))
    const galaxy = sky.galaxy.mul(mix(vec3(1), palette.star, 0.5)).mul(shownFill).mul(far.oneMinus())
    const gold = color(hsl.integer(79, 99, 84)).mul(flakes(p, frame.outward, 170, 0.12).mul(shownFill.oneMinus()).mul(3))
    // Pinpoint stars and flakes turn to glitter noise from afar, so they bow out and leave the figures to speak.
    const pinpoints = far.mul(0.75).oneMinus()
    const skyLight = sky.nebula.mul(head.mul(0.5).oneMinus()).add(sky.stars.mul(shownFill.oneMinus()).add(galaxy).add(gold).mul(pinpoints))
    // Figures wrapping over the silhouette compress into bright smears; let them recede there.
    const grazingCalm = facing.smoothstep(0.06, 0.4).mul(0.55).add(0.45)
    // A thin cool atmosphere along the silhouette separates the black knot from the dark room.
    const atmosphere = color(hsl.integer(265, 75, 35)).mul(grazing.pow(5).mul(0.2))
    // --- threads of stardust tie every cat’s ears to its neighbors’, knotted at a shared point on the cell border
    // The knot is a fixed point on the tube, so its place in cat units uses the stretch at the knot itself, not at the fragment.
    const knotPoint = (side: -1 | 1) => {
      const [height, stretch] = side === -1 ? [knots.x, knots.y] : [knots.z, knots.w]
      return toCat(vec2(stretch.mul(cellWidth / catScale / 2 * side), cellScale.y.mul(0.5).mul(height)))
    }
    const [leftKnot, rightKnot] = [knotPoint(-1), knotPoint(1)]
    const leftThread = strand(catPoint, cat.ears.left, leftKnot, footprint, 0.0025, 0.11, 0.12)
    const rightThread = strand(catPoint, cat.ears.right, rightKnot, footprint, 0.0025, 0.11, 0.12)
    // Threads leave the ear stars softly instead of cutting through their glare.
    const leftCoverage = leftThread.coverage.mul(leftThread.h.smoothstep(0.06, 0.22))
    const rightCoverage = rightThread.coverage.mul(rightThread.h.smoothstep(0.06, 0.22))
    const knotStars = catPoint.sub(leftKnot).length().min(catPoint.sub(rightKnot).length()).div(footprint.mul(1.2).max(0.022)).pow2().negate().exp()
    const threads = leftCoverage.max(rightCoverage).mul(cat.grown.mul(1.2).clamp()).add(knotStars.mul(0.8)).mul(far.oneMinus().mul(0.7).add(0.3))
    const threadLight = color(hsl.integer(79, 100, 91)).mul(threads.mul(0.9)).mul(grazingCalm)
    const tubeFootprint = vec2(tube.x.mul(knotLength), tube.y.mul(TAU * tubeRadius)).fwidth().length().mul(0.7)
    const meteor = meteors.light(tube, knotLength, TAU * tubeRadius, tubeFootprint)
    const meteorLight = color(hsl.integer(88, 100, 95.5)).mul(meteor.head.mul(5)).add(mix(color(hsl.integer(244, 100, 77)), color(hsl.integer(83, 100, 92.4)), meteor.tail).mul(meteor.tail.mul(2.2)))
    this.emissiveNode = skyLight.add(atmosphere).add(threadLight).add(meteorLight).add(figure.mul(window).mul(grazingCalm))
    // --- surface: black lacquer sky, faceted glass inside the cats
    this.colorNode = mix(color(hsl.integer(275, 32, 4)), palette.fill.mul(0.045), shownFill)
    this.metalnessNode = shownFill.mul(0.2)
    this.roughnessNode = mix(float(0.6), float(0.22), shownFill)
    // Black lacquer: the crisp clearcoat supplies the reflection, the pigment layer beneath barely any.
    this.specularIntensityNode = mix(float(0.02), float(1), shownFill)
    // A thin, crisp lacquer: enough to mirror the gallery, not enough to drown the stars.
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.035
    this.clearcoatNormalNode = normalViewGeometry
    this.iridescenceNode = shownFill.mul(0.5)
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = sky.density.mul(260).add(260)
    const catNormal = cat.normal.normalize()
    const facet = mix(vec3(0, 0, 1), vec3(catNormal.xy.mul(0.55), catNormal.z), shownFill)
    const facetInCell = vec3(rotateOut(facet.xy), facet.z)
    const objectNormal = frame.along.mul(facetInCell.x).add(up.mul(facetInCell.y)).add(frame.outward.mul(facetInCell.z)).normalize()
    this.normalNode = negateOnBackSide(transformNormalToView(objectNormal))
  }
}
