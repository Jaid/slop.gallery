import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, time, uv, vec2, vec3, wgslFn} from 'three/tsl'

import {inkLine, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import data from './data.ts'

type Star = readonly [x: number, y: number, radius: number, articulation: number]
type Connection = readonly [from: number, to: number, radiance: number]
type Constellation = {
  connections: ReadonlyArray<Connection>
  stars: ReadonlyArray<Star>
}

/** Articulation: 0 = body, 1 = eye, 2…3 = tail root…tip. Positions are hand-drawn, not a random triangulation. */
const sittingCat: Constellation = {
  stars: [
    [-0.05, 0.265, 0.007, 0],
    [-0.13, 0.27, 0.005, 0],
    [-0.25, 0.435, 0.014, 0],
    [-0.275, 0.125, 0.007, 0],
    [-0.2, 0.02, 0.007, 0],
    [-0.075, -0.035, 0.009, 0],
    [0.075, 0.02, 0.007, 0],
    [0.155, 0.145, 0.007, 0],
    [0.14, 0.435, 0.014, 0],
    [0.035, 0.275, 0.005, 0],
    [-0.16, 0.15, 0.01, 1],
    [0.035, 0.15, 0.01, 1],
    [-0.065, 0.075, 0.006, 0],
    [-0.14, -0.135, 0.012, 0],
    [0.1, -0.105, 0.009, 0],
    [0.23, -0.275, 0.013, 0],
    [0.18, -0.405, 0.007, 0],
    [-0.005, -0.415, 0.011, 0],
    [-0.16, -0.405, 0.012, 0],
    [-0.18, -0.255, 0.006, 0],
    [-0.065, -0.265, 0.006, 0],
    [0.22, -0.355, 0.007, 2],
    [0.355, -0.35, 0.008, 2.14],
    [0.455, -0.245, 0.01, 2.29],
    [0.47, -0.11, 0.007, 2.43],
    [0.415, -0.005, 0.007, 2.57],
    [0.325, 0.025, 0.008, 2.71],
    [0.265, -0.03, 0.006, 2.86],
    [0.295, -0.09, 0.015, 3],
    [-0.39, 0.13, 0.004, 0],
    [-0.405, 0.04, 0.004, 0],
    [0.275, 0.13, 0.004, 0],
    [0.29, 0.045, 0.004, 0],
  ],
  connections: [
    [0, 1, 0.8],
    [1, 2, 1],
    [2, 3, 1],
    [3, 4, 0.85],
    [4, 5, 0.85],
    [5, 6, 0.85],
    [6, 7, 0.85],
    [7, 8, 1],
    [8, 9, 1],
    [9, 0, 0.8],
    [1, 3, 0.2],
    [9, 7, 0.2],
    [10, 12, 0.35],
    [11, 12, 0.35],
    [12, 5, 0.4],
    [4, 29, 0.6],
    [4, 30, 0.6],
    [6, 31, 0.6],
    [6, 32, 0.6],
    [5, 13, 0.9],
    [6, 14, 0.9],
    [13, 19, 0.9],
    [19, 18, 0.9],
    [18, 17, 0.9],
    [17, 16, 0.9],
    [16, 15, 0.9],
    [15, 14, 0.9],
    [13, 20, 0.75],
    [20, 17, 0.75],
    [14, 20, 0.16],
    [13, 14, 0.2],
    [15, 21, 0.6],
    [21, 22, 0.9],
    [22, 23, 0.9],
    [23, 24, 0.9],
    [24, 25, 0.9],
    [25, 26, 0.9],
    [26, 27, 0.9],
    [27, 28, 0.9],
  ],
}
/** An alert cat in profile: long back, separate forelegs and an upturned question-mark tail. */
const prowlingCat: Constellation = {
  stars: [
    [-0.47, 0.17, 0.008, 0],
    [-0.35, 0.14, 0.005, 0],
    [-0.28, 0.08, 0.007, 0],
    [-0.16, 0.17, 0.007, 0],
    [-0.15, 0.3, 0.006, 0],
    [-0.16, 0.5, 0.012, 0],
    [-0.245, 0.37, 0.005, 0],
    [-0.32, 0.49, 0.01, 0],
    [-0.36, 0.28, 0.008, 0],
    [-0.3, 0.235, 0.013, 1],
    [-0.1, 0.08, 0.008, 0],
    [-0.01, 0.06, 0.012, 0],
    [0.18, 0.075, 0.007, 0],
    [0.35, 0.035, 0.013, 0],
    [0.29, -0.13, 0.007, 0],
    [0.36, -0.26, 0.005, 0],
    [0.25, -0.33, 0.012, 0],
    [0.18, -0.15, 0.006, 0],
    [0.08, -0.075, 0.007, 0],
    [-0.095, -0.145, 0.006, 0],
    [-0.2, -0.29, 0.013, 0],
    [-0.015, -0.135, 0.005, 0],
    [0.02, -0.31, 0.009, 0],
    [0.38, 0.105, 0.006, 2],
    [0.49, 0.23, 0.009, 2.2],
    [0.48, 0.36, 0.006, 2.4],
    [0.38, 0.42, 0.01, 2.6],
    [0.285, 0.37, 0.007, 2.8],
    [0.285, 0.28, 0.015, 3],
    [-0.53, 0.26, 0.004, 0],
    [-0.535, 0.12, 0.004, 0],
  ],
  connections: [
    [0, 1, 0.9],
    [1, 2, 0.9],
    [2, 3, 0.9],
    [3, 4, 0.8],
    [4, 5, 1],
    [5, 6, 1],
    [6, 7, 1],
    [7, 8, 1],
    [8, 0, 0.9],
    [6, 4, 0.2],
    [9, 0, 0.3],
    [9, 3, 0.2],
    [1, 29, 0.5],
    [1, 30, 0.5],
    [3, 10, 0.9],
    [10, 11, 0.9],
    [11, 12, 0.9],
    [12, 13, 0.9],
    [13, 14, 0.8],
    [14, 15, 0.8],
    [15, 16, 0.9],
    [16, 17, 0.8],
    [17, 18, 0.8],
    [18, 21, 0.8],
    [21, 22, 0.8],
    [22, 19, 0.7],
    [19, 20, 0.9],
    [20, 2, 0.9],
    [11, 19, 0.2],
    [11, 18, 0.16],
    [12, 17, 0.2],
    [13, 23, 0.8],
    [23, 24, 0.9],
    [24, 25, 0.9],
    [25, 26, 0.9],
    [26, 27, 0.9],
    [27, 28, 0.9],
  ],
}
const constellationPeriod = [12, 3] as const
const catBounds = 0.66
const scalar = (value: number) => value.toFixed(6)
/** Constant-index code keeps the tiny graph in registers rather than per-fragment dynamic arrays. */
function graphFunction(name: string, cat: Constellation) {
  const points = cat.stars.map((star, i) => `let p${i} = noctilucaPoint(vec4<f32>(${star.map(scalar).join(', ')}), phase);`).join('\n')
  const stars = cat.stars.map((star, i) => `stars += noctilucaStar(p, p${i}, ${scalar(star[2])}, ${scalar(star[3])}, ${scalar(i)}, aa, phase, clock, identity, intimacy);`).join('\n')
  const edges = cat.connections.map(([a, b, radiance], i) => `let e${i} = noctilucaEdge(p, p${a}, p${b}, ${scalar(radiance)}, ${cat.stars[b][3] > 1.5 ? '1.6' : '1.0'}, ${scalar(i)}, aa, clock, identity, intimacy);\nthreads = max(threads, e${i}.x);\nhalo += e${i}.y;`).join('\n')
  return `fn ${name}(p: vec2<f32>, aa: f32, phase: f32, clock: f32, identity: f32, intimacy: f32) -> vec4<f32> {
    ${points}
    var stars = vec3<f32>(0.0);
    ${stars}
    var threads = 0.0;
    var halo = 0.0;
    ${edges}
    return vec4<f32>(threads, stars.x, stars.y + halo, stars.z);
  }`
}
/** Four radiance channels: silver threads, star cores, local aureoles and amber eyes. */
const catWgsl = `
fn noctilucaCat(p: vec2<f32>, footprint: f32, clock: f32, identity: f32, intimacy: f32) -> vec4<f32> {
  // Derivatives are supplied by the caller before wrapping and before divergent control flow.
  let extent = max(abs(p.x), abs(p.y));
  if (extent > ${catBounds}) { return vec4<f32>(0.0); }
  let phase = clock * 0.7 + identity * 6.283185;
  let aa = max(footprint * 0.65, 0.0003);
  let support = 1.0 - smoothstep(0.60, ${catBounds}, extent);
  if (identity > 0.5) {
    return noctilucaProwl(p, aa, phase, clock, identity, intimacy) * support;
  }
  return noctilucaSit(p, aa, phase, clock, identity, intimacy) * support;
}

fn noctilucaPoint(s: vec4<f32>, phase: f32) -> vec2<f32> {
  var point = s.xy;
  point.y += sin(phase) * 0.014 * smoothstep(-0.4, 0.15, point.y);
  point.x += sin(phase * 0.63) * 0.013 * smoothstep(-0.1, 0.4, point.y);
  if (s.w > 1.5) {
    let tip = s.w - 2.0;
    point.x += sin(phase * 1.3 + tip * 2.5) * tip * 0.025;
    point.y += cos(phase * 1.3 + tip * 2.5) * tip * 0.025;
  }
  return point;
}

fn noctilucaStar(p: vec2<f32>, point: vec2<f32>, magnitude: f32, role: f32, index: f32, aa: f32, phase: f32, clock: f32, identity: f32, intimacy: f32) -> vec3<f32> {
  let delta = p - point;
  let d = length(delta);
  let twinkle = 0.8 + 0.2 * sin(phase * 1.9 + index * 2.39996);
  let radius = magnitude * (0.9 + 0.1 * twinkle);
  let coverage = 1.0 - smoothstep(max(radius - aa, 0.0), radius + aa, d);
  let energy = min(1.0, radius * radius / (aa * aa));
  let core = coverage * energy;
  let aura = exp(-d * d / (radius * radius * 14.0)) * twinkle;
  if (role == 1.0) {
    // Each cat closes its eyes briefly, independently of its neighbors.
    let blink = pow(max(0.0, cos(clock * 0.83 + identity * 21.0)), 90.0);
    return vec3<f32>(0.0, 0.0, (core * 1.3 + aura * 0.045) * (1.0 - blink * 0.92));
  }
  // Tiny diffraction needles resolve only during an intimate inspection.
  let cross = exp(-abs(delta.x) / (aa + 0.0008) - abs(delta.y) / 0.028)
    + exp(-abs(delta.y) / (aa + 0.0008) - abs(delta.x) / 0.028);
  return vec3<f32>(core * twinkle + cross * 0.09 * intimacy * pow(twinkle, 8.0) * energy, aura * 0.22, 0.0);
}

fn noctilucaEdge(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, radiance: f32, tail: f32, index: f32, aa: f32, clock: f32, identity: f32, intimacy: f32) -> vec2<f32> {
  let ab = b - a;
  let t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.000001), 0.0, 1.0);
  let d = length(p - mix(a, b, t));
  let width = mix(0.00115, 0.0022, radiance);
  let line = (1.0 - smoothstep(width, width + aa, d)) * min(1.0, 2.0 * width / aa) * tail;
  // A soft packet travels down each connection, not a whole-object strobe.
  let packet = pow(0.5 + 0.5 * sin(t * 5.0 - clock * 1.8 + index * 1.7 + identity * 9.0), 12.0);
  let detail = select(0.35 + intimacy * 0.65, 1.0, radiance > 0.5);
  return vec2<f32>(line * radiance * detail * (0.55 + packet * 1.1), exp(-d * d / 0.00014) * radiance * 0.012);
}

${graphFunction('noctilucaSit', sittingCat)}
${graphFunction('noctilucaProwl', prowlingCat)}
`
const catField = wgslFn(catWgsl)
/** Sparse, periodic pinpricks behind the articulated constellations. */
function dust(coordinate: Node<'vec2'>, period: Node<'vec2'>, seed: number) {
  const q = coordinate.mul(period)
  const aa = q.fwidth().length().max(0.0001)
  const random = cellNoiseVec3(vec3(wrapCell(q.floor(), period), seed))
  const center = random.xy.mul(0.5).add(0.25)
  const d = q.fract().sub(center).length()
  const radius = random.z.mul(0.027).add(0.019)
  const point = d.smoothstep(radius, radius.add(aa)).oneMinus()
    .mul(radius.div(aa.max(radius)).pow2())
  const pulse = time.mul(0.6).add(random.x.mul(TAU)).sin().mul(0.18).add(0.82)
  return point.mul(random.z.smoothstep(0.65, 0.85)).mul(pulse)
}

/** A nocturnal star atlas: articulated feline graphs float over a recessed, slower-moving sky. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.25)
    this.name = data.id
    const {p, facing, grazing, objectDistance, view} = viewerFrame()
    const intimacy = objectDistance.smoothstep(1.7, 4.8).oneMinus()
    const ray = tubeRay()
    const tube = uv()
    const modules = vec2(...constellationPeriod)
    const chartMetric = vec2(2.05, 1.36)
    // Integer winding and wrapped identities keep both UV seams invisible.
    const atlasUV = tube.add(vec2(tube.y.mul(TAU * 2).sin().mul(0.007), 0))
    const q = atlasUV.sub(ray.mul(0.018)).mul(modules)
    const identity = cellNoiseVec3(vec3(wrapCell(q.floor(), modules), 19.73))
    // Let the spine follow the long axis of the tube rather than disappear around its cross-section.
    const local = q.fract().sub(0.5).mul(chartMetric).yx
    const footprint = q.mul(chartMetric).fwidth().length().max(0.0001)
    const mirror = identity.y.step(0.5).mul(2).sub(1)
    const angle = identity.z.sub(0.5).mul(0.26)
    const point = vec2(local.x.mul(angle.cos()).sub(local.y.mul(angle.sin())).mul(mirror), local.x.mul(angle.sin()).add(local.y.mul(angle.cos())))
    const cat = (catField({
      p: point,
      footprint,
      clock: time,
      identity: identity.x,
      intimacy,
    }) as Node<'vec4'>).toVar()
    const viewColor = view.dot(vec3(0.6, 0.3, 0.74)).mul(0.5).add(0.5)
    const silver = mix(color(hsl.integer(203, 78, 83.5)), color(hsl.integer(292, 100, 79)), viewColor)
    const amber = mix(color(hsl.integer(63, 100, 74.7)), color(hsl.integer(90, 100, 91.9)), facing)
    const constellation = silver.mul(cat.x).mul(0.48)
      .add(mix(silver, color(hsl.integer(226, 100, 98)), 0.8).mul(cat.y).mul(3.4))
      .add(silver.mul(cat.z).mul(0.55))
      .add(amber.mul(cat.w).mul(2.1))
    // The atlas is deeper than the cats: changing the viewing angle separates both strata.
    const backUV = atlasUV.sub(ray.mul(0.057))
    const backQ = backUV.mul(modules)
    const backIdentity = cellNoiseVec3(vec3(wrapCell(backQ.floor(), modules), 19.73))
    const back = backQ.fract().sub(0.5).mul(chartMetric).yx
    const backFoot = backQ.mul(chartMetric).fwidth().length().max(0.0001)
    const orbitPoint = back.sub(vec2(-0.035, 0)).mul(vec2(0.83, 1))
    const r = orbitPoint.length()
    const theta = mx_atan2(orbitPoint.y, orbitPoint.x.add(0.00001)) as unknown as Node<'float'>
    const ring = inkLine(r.sub(0.49), 0.00085, backFoot)
    const angularFoot = backFoot.div(r.max(0.1))
    const ticks = theta.mul(72).cos().smoothstep(0.95, 0.995)
      .mul(angularFoot.mul(72).smoothstep(0.4, 2).oneMinus())
      .mul(r.smoothstep(0.477, 0.487)).mul(r.smoothstep(0.509, 0.522).oneMinus())
    const arcGate = theta.add(backIdentity.x.mul(TAU)).sin().smoothstep(0.65, 0.85)
    const atlas = ring.mul(0.25).add(ticks.mul(0.3)).mul(arcGate)
      .mul(intimacy.mul(0.8).add(0.2))
    const stars = dust(tube.sub(ray.mul(0.045)), vec2(144, 18), 41)
      .add(dust(tube.sub(ray.mul(0.085)), vec2(228, 28), 72).mul(0.48))
    const grain = mx_noise_float(p.mul(85)).mul(0.5).add(0.5)
    const silk = mx_noise_float(p.mul(5).add(vec3(0, time.mul(0.015), 0))).mul(0.5).add(0.5)
    const edgeTint = mix(color(hsl.integer(238, 70, 24)), color(hsl.integer(299, 54, 21)), viewColor)
    const enamel = mix(color(hsl.integer(262, 69, 6)), color(hsl.integer(265, 59, 13)), silk)
    this.colorNode = mix(enamel, edgeTint, grazing.pow(2).mul(0.65))
    this.metalness = 0.78
    this.roughnessNode = float(0.38).add(grain.mul(0.045))
    this.clearcoat = 0.16
    this.clearcoatRoughness = 0.32
    this.ior = 1.46
    this.emissiveNode = constellation.mul(facing.smoothstep(0.02, 0.3).mul(0.7).add(0.3))
      .add(color(hsl.integer(78, 62, 73)).mul(atlas).mul(0.15))
      .add(color(hsl.integer(234, 65, 77.4)).mul(stars).mul(1.1))
      .add(edgeTint.mul(grazing.pow(3)).mul(0.35))
      .add(color(hsl.integer(263, 71, 16)).mul(silk).mul(0.2))
  }
}
