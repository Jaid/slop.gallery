import type {Vec3} from 'math'

import {ImprovedNoise} from 'three/addons/math/ImprovedNoise.js'
import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

const pitch = 0.035
const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const

/** A sawn block with chips along its top and uprights; its unbroken foot sits flush on the surface below. */
export default class CrumbledStoneGeometry extends BufferGeometry {
  constructor(size: Vec3) {
    super()
    const positions: Array<number> = []
    const uvs: Array<number> = []
    const indices: Array<number> = []
    const noise = new ImprovedNoise
    const rim = Math.min(pitch, Math.min(...size) / 8)
    const face = (u: number, v: number, w: number, du: number, dv: number, dw: number) => {
      const point = (s: number, t: number, inset: number): Vec3 => {
        const p: Vec3 = [0, 0, 0]
        p[u] = s * du * (size[u] / 2 - inset)
        p[v] = t * dv * (size[v] / 2 - inset)
        p[w] = dw * size[w] / 2
        return p
      }
      const vertex = (p: Vec3) => {
        uvs.push(0.5 + du * p[u] / size[u], 0.5 + dv * p[v] / size[v])
        return positions.push(...p) / 3 - 1
      }
      const ring = (inset: number) => corners.map(([s, t]) => vertex(point(s, t, inset)))
      if (w === 1 && dw < 0) {
        // The underside is one uncut rectangle, including its four corners.
        const [a, b, c, d] = ring(0)
        indices.push(a, b, c, a, c, d)
        return
      }
      const core = ring(2 * rim)
      const lip = ring(rim)
      indices.push(core[0], core[1], core[2], core[0], core[2], core[3])
      // Evaluate a chip in object space so adjoining faces meet at exactly the same cut.
      const nick = (p: Vec3) => {
        if (p[1] === -size[1] / 2) {
          return 0
        }
        return Math.min(rim * 0.8, 0.003 + 0.025 * Math.max(0, noise.noise(p[0] * 17 + 2.7, p[1] * 17, p[2] * 17)))
      }
      const chipped = (p: Vec3, s: number, t: number, cut: number) => {
        if (Math.abs(s) === 1) {
          p[u] -= s * du * cut
        }
        if (Math.abs(t) === 1) {
          p[v] -= t * dv * cut
        }
        p[w] -= dw * cut
        return vertex(p)
      }
      const tips = corners.map(([s, t]) => {
        const p = point(s, t, 0)
        return chipped(p, s, t, nick(p))
      })
      for (const [i, [s, t]] of corners.entries()) {
        const j = (i + 1) % 4
        const alongU = s !== corners[j][0]
        const segments = Math.ceil(size[alongU ? u : v] / pitch)
        const samples = Array.from({length: segments + 1}, (_, k) => {
          const along = (segments - 2 * k) / segments
          const a = alongU ? s * along : s
          const b = alongU ? t : t * along
          const p = point(a, b, 0)
          return {
            a,
            b,
            p,
            cut: nick(p),
          }
        })
        let outer = tips[i]
        let inner = lip[i]
        for (let k = 1; k <= segments; k++) {
          const {a, b, p, cut} = samples[k]
          const end = k === segments
          // In an unbroken stretch the intermediate vertex changes neither the rim nor its silhouette.
          if (!end && samples[k - 1].cut === cut && samples[k + 1].cut === cut) {
            continue
          }
          const nextOuter = end ? tips[j] : chipped(p, a, b, cut)
          const nextInner = end ? lip[j] : vertex(point(a, b, rim))
          indices.push(outer, nextOuter, nextInner, outer, nextInner, inner)
          // Stitch the subdivided lip to the single straight edge of the flat core, without T-junctions.
          indices.push(inner, nextInner, core[i])
          outer = nextOuter
          inner = nextInner
        }
        indices.push(core[i], lip[j], core[j])
      }
    }
    // Local u and v follow the box UVs; viewed from outside, each face winds counterclockwise.
    face(2, 1, 0, -1, 1, 1)
    face(2, 1, 0, 1, 1, -1)
    face(0, 2, 1, 1, -1, 1)
    face(0, 2, 1, 1, 1, -1)
    face(0, 1, 2, 1, 1, 1)
    face(0, 1, 2, -1, 1, -1)
    this.setIndex(indices)
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    this.computeVertexNormals()
  }
}
