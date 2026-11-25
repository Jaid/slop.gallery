import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3, wgslFn} from 'three/tsl'

import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Integer periods preserve identities across both knot UV seams. */
const constellationLayout = [14, 2] as const
/** An authored feline asterism, not a font, image or generic triangulation. Positive Y points toward the ears. */
const stars = [
  [-0.29, 0.08], // 0 left temple
  [-0.31, 0.405], // 1 left ear tip
  [-0.125, 0.165], // 2 left ear root
  [0, 0.18], // 3 crown
  [0.125, 0.165], // 4 right ear root
  [0.31, 0.405], // 5 right ear tip
  [0.29, 0.08], // 6 right temple
  [0.26, -0.105], // 7 right cheek
  [0.14, -0.255], // 8 right jaw
  [0, -0.32], // 9 chin
  [-0.14, -0.255], // 10 left jaw
  [-0.26, -0.105], // 11 left cheek
  [-0.225, 0.035], // 12 left eye outer
  [-0.145, 0.061], // 13 left eye upper
  [-0.058, 0.008], // 14 left eye inner
  [-0.145, 0.002], // 15 left eye lower
  [0.058, 0.008], // 16 right eye inner
  [0.145, 0.061], // 17 right eye upper
  [0.225, 0.035], // 18 right eye outer
  [0.145, 0.002], // 19 right eye lower
  [0, -0.105], // 20 nose
  [-0.032, -0.075], // 21 nose left
  [0.032, -0.075], // 22 nose right
  [0, -0.19], // 23 muzzle center
  [-0.1, -0.177], // 24 left muzzle
  [0.1, -0.177], // 25 right muzzle
  [-0.255, 0.28], // 26 inner ear left
  [0.255, 0.28], // 27 inner ear right
  [0, 0.115], // 28 forehead jewel
  [-0.145, 0.024], // 29 left pupil
  [0.145, 0.024], // 30 right pupil
  [-0.405, -0.042], // 31 upper left whisker
  [-0.438, -0.145], // 32 middle left whisker
  [-0.38, -0.265], // 33 lower left whisker
  [0.405, -0.042], // 34 upper right whisker
  [0.438, -0.145], // 35 middle right whisker
  [0.38, -0.265], // 36 lower right whisker
  [-0.14, 0.12], // 37 left brow
  [0.14, 0.12], // 38 right brow
] as const satisfies ReadonlyArray<readonly [number, number]>
/** Edge classes: silhouette, internal triangulation, amber eyes and whiskers. */
const threads = [
  [0, 1, 0],
  [1, 2, 0],
  [2, 3, 0],
  [3, 4, 0],
  [4, 5, 0],
  [5, 6, 0],
  [6, 7, 0],
  [7, 8, 0],
  [8, 9, 0],
  [9, 10, 0],
  [10, 11, 0],
  [11, 0, 0],
  [0, 26, 1],
  [26, 1, 1],
  [26, 2, 1],
  [4, 27, 1],
  [27, 5, 1],
  [27, 6, 1],
  [2, 37, 1],
  [37, 28, 1],
  [28, 38, 1],
  [38, 4, 1],
  [12, 13, 2],
  [13, 14, 2],
  [14, 15, 2],
  [15, 12, 2],
  [16, 17, 2],
  [17, 18, 2],
  [18, 19, 2],
  [19, 16, 2],
  [21, 22, 2],
  [22, 20, 2],
  [20, 21, 2],
  [20, 23, 0],
  [23, 24, 0],
  [23, 25, 0],
  [24, 21, 1],
  [25, 22, 1],
  [24, 31, 3],
  [24, 32, 3],
  [24, 33, 3],
  [25, 34, 3],
  [25, 35, 3],
  [25, 36, 3],
] as const satisfies ReadonlyArray<readonly [number, number, number]>
const points = stars.map(([x, y]) => `vec2<f32>(${x.toFixed(4)}, ${y.toFixed(4)})`).join(',\n')
const edges = threads.map(([a, b, kind]) => `vec3<u32>(${a}u, ${b}u, ${kind}u)`).join(',\n')
/** Native WebGPU keeps the graph in small constant arrays instead of expanding dozens of TSL subgraphs. All filtering uses the unwrapped footprint supplied by the caller. */
const stellarGraph = wgslFn(`
fn stellarGraph(coordinate: vec2<f32>, ray: vec2<f32>, footprint: f32, seconds: f32, proximity: f32, angle: f32) -> vec3<f32> {
  let cell = floor(coordinate);
  let period = vec2<f32>(${constellationLayout.map(value => value.toFixed(1)).join(', ')});
  let identity = cell - floor(cell / period) * period;
  let seed = asterHash(dot(identity, vec2<f32>(17.17, 53.71)) + 9.2);
  let phase = seed * 6.2831853;
  let clock = seconds + seed * 11.0;
  let turn = 0.1 * sin(phase + seconds * 0.17);
  let breathing = 1.0 + 0.025 * sin(clock * 1.7);
  let local = fract(coordinate) - 0.5;
  var p = vec2<f32>(local.y, -local.x * 1.08);
  let orientedRay = vec2<f32>(ray.y, -ray.x);
  p = asterRotate(p, turn) / breathing;
  let aa = max(footprint, 0.00035);
  let detail = 1.0 - smoothstep(0.025, 0.12, aa);
  let cyan = vec3<f32>(0.19, 0.8, 1.0);
  let violet = vec3<f32>(0.54, 0.27, 1.0);
  let gold = vec3<f32>(1.0, 0.51, 0.13);
  let ice = vec3<f32>(0.68, 0.95, 1.0);
  let tint = mix(cyan, violet, 0.5 + 0.5 * sin(phase + angle * 2.6));
  // A quiet inhalation loosens the constellation into a small cloud, then reconnects it.
  let release = pow(0.5 + 0.5 * sin(clock * 0.53 - 1.5), 10.0);
  let blinkPhase = abs(sin(clock * 0.47 + 1.1));
  let blink = smoothstep(0.025, 0.14, blinkPhase);
  let wake = 0.5 + 0.5 * sin(p.y * 10.0 - clock * 2.2);
  let positions = array<vec2<f32>, ${stars.length}>(
${points}
  );
  let connections = array<vec3<u32>, ${threads.length}>(
${edges}
  );
  var posed: array<vec2<f32>, ${stars.length}>;
  var radiance = vec3<f32>(0.0);
  for (var i = 0u; i < ${stars.length}u; i++) {
    let index = f32(i);
    let random = asterHash(index * 13.17 + seed * 19.0);
    var v = positions[i];
    // The eyes close as an articulated almond, not as a fading texture.
    if ((i >= 12u && i <= 19u) || i == 29u || i == 30u) {
      v.y = 0.024 + (v.y - 0.024) * (0.09 + 0.91 * blink);
    }
    if (i == 29u || i == 30u) {
      v += vec2<f32>(clamp(ray.x * 0.08, -0.013, 0.013), 0.007 * sin(clock * 0.7));
    }
    if (i == 1u || i == 5u || i == 26u || i == 27u) {
      v.x += 0.019 * sin(clock * 2.1 + sign(v.x) * 1.7) * sin(clock * 0.7);
      v.y += 0.013 * sin(clock * 1.3 + sign(v.x));
    }
    if (i >= 31u && i <= 36u) {
      v.y += 0.018 * sin(clock * 2.5 + index * 0.9);
    }
    let freeStar = asterRotate(v * 0.62, clock * 0.55 + random * 1.8) + vec2<f32>(sin(index * 2.3 + clock), cos(index * 1.7 - clock * 0.8)) * 0.085;
    v = mix(v, freeStar, release);
    v += vec2<f32>(sin(index * 2.3 + clock), cos(index * 1.7 - clock * 0.8)) * 0.0025;
    // Each star sits at a slightly different depth in the optical volume.
    v += orientedRay * (random - 0.5) * 0.012;
    posed[i] = v;
    let delta = p - v;
    let d = length(delta);
    let hero = select(0.0, 1.0, i == 1u || i == 5u || i == 20u || i == 28u);
    let pupil = select(0.0, 1.0, i == 29u || i == 30u);
    let radius = 0.005 + random * 0.002 + hero * 0.006 + pupil * 0.002;
    let core = (1.0 - smoothstep(max(0.0, radius - aa), radius + aa, d)) * pow(radius / max(radius, aa), 2.0);
    let halo = exp(-d * d / (0.00022 + hero * 0.00018));
    let twinkle = 0.72 + 0.28 * sin(clock * (1.4 + random * 2.5) + index * 4.2 + angle * 5.0);
    let pulse = pow(0.5 + 0.5 * sin(v.y * 10.0 - clock * 2.2), 9.0);
    let starColor = mix(ice, gold, max(pupil, select(0.0, 0.65, i == 20u)));
    radiance += starColor * core * (2.2 + pulse * 3.8) * twinkle * mix(1.0, blink, pupil);
    radiance += mix(tint, gold, pupil) * halo * (0.12 + pulse * 0.3) * detail;
    // A warm vertical pupil contracts with the blink; the white node remains the catchlight.
    let slitDistance = length(vec2<f32>(delta.x, max(0.0, abs(delta.y) - 0.013 * blink)));
    let slit = (1.0 - smoothstep(0.0015, 0.0025 + aa, slitDistance)) * min(1.0, 0.005 / aa);
    radiance += gold * slit * pupil * blink * (1.0 - release) * 1.8;
    // Comet dust follows the disassembling stars, entirely inside the original cell.
    for (var tail = 1u; tail <= 3u; tail++) {
      let lag = f32(tail) * 0.012;
      let trailing = v + vec2<f32>(cos(clock + index), sin(clock + index)) * lag;
      let td = p - trailing;
      radiance += mix(tint, gold, random) * exp(-dot(td, td) / 0.000025) * release * (0.5 / f32(tail)) * detail;
    }
    let flarePoint = asterRotate(delta, angle * 0.25 + 0.35);
    let flare = exp(-abs(flarePoint.x) * 55.0 - abs(flarePoint.y) * 680.0) + exp(-abs(flarePoint.y) * 75.0 - abs(flarePoint.x) * 680.0);
    radiance += starColor * flare * hero * twinkle * (0.16 + pulse * 0.65) * detail;
  }
  for (var e = 0u; e < ${threads.length}u; e++) {
    let edge = connections[e];
    let a = posed[edge.x];
    let b = posed[edge.y];
    let ab = b - a;
    let h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.000001), 0.0, 1.0);
    let d = length(p - a - h * ab);
    let internal = select(0.0, 1.0, edge.z == 1u);
    let whisker = select(0.0, 1.0, edge.z == 3u);
    let amber = select(0.0, 1.0, edge.z == 2u);
    let width = mix(0.00165, 0.0008, internal);
    let thread = (1.0 - smoothstep(width, width + aa, d)) * min(1.0, width * 2.0 / aa);
    let travel = fract(clock * 0.34 + f32(e) * 0.137);
    let packet = exp(-pow((h - travel) * length(ab) / 0.014, 2.0));
    let scintillation = 0.7 + 0.3 * sin(f32(e) * 5.1 + clock * 1.9);
    let dotted = mix(1.0, 0.45 + 0.55 * pow(0.5 + 0.5 * cos(h * length(ab) * 440.0 - clock * 3.0), 4.0), whisker * proximity * detail);
    let brightness = mix(0.26, 0.045 + proximity * 0.07, internal) * scintillation;
    let threadColor = mix(tint, gold, amber);
    radiance += threadColor * thread * (brightness + packet * (0.3 + proximity * 0.3)) * dotted * (1.0 - release * 0.94);
    // Tiny intermediary stars make the drawing feel assembled from points rather than wire mesh.
    let subdivision = round(h * 5.0) / 5.0;
    let beadDelta = p - mix(a, b, subdivision);
    radiance += ice * exp(-dot(beadDelta, beadDelta) / 0.000009) * (1.0 - internal) * proximity * 0.6 * detail * (1.0 - release);
    radiance += threadColor * exp(-d * d / 0.000065) * packet * 0.055 * detail;
  }
  // Broken astrolabe arcs float behind the ears, with a bright wandering satellite.
  let orbit = asterRotate(p + vec2<f32>(0.0, 0.025), -0.4 + phase * 0.15);
  let ellipse = orbit * vec2<f32>(1.0, 0.79);
  let theta = atan2(ellipse.y, ellipse.x);
  let radius = length(ellipse);
  let arc = pow(0.5 + 0.5 * sin(theta * 3.0 + clock * 0.28), 6.0);
  let orbitLine = (1.0 - smoothstep(0.0007, 0.0007 + aa, abs(radius - 0.375))) * min(1.0, 0.0014 / aa);
  radiance += mix(gold, tint, 0.6) * orbitLine * arc * 0.16;
  let cometAngle = clock * 0.39;
  let comet = vec2<f32>(cos(cometAngle), sin(cometAngle)) * 0.375;
  let cometDelta = ellipse - comet;
  radiance += gold * exp(-dot(cometDelta, cometDelta) / 0.000055) * detail * 1.6;
  radiance += tint * exp(-dot(p, p) * 24.0) * wake * 0.014;
  return radiance * (0.8 + proximity * 0.2);
}

fn asterHash(n: f32) -> f32 {
  return fract(sin(n * 127.1) * 43758.5453);
}

fn asterRotate(p: vec2<f32>, a: f32) -> vec2<f32> {
  return vec2<f32>(cos(a) * p.x - sin(a) * p.y, sin(a) * p.x + cos(a) * p.y);
}
`)

/** Feline asterisms in optical-depth obsidian. The geometry and silhouette remain untouched. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.22)
    this.name = data.id
    const {p, grazing, facing, objectDistance} = viewerFrame()
    const proximity = objectDistance.smoothstep(1.5, 5.5).oneMinus()
    const ray = tubeRay()
    const modules = vec2(...constellationLayout)
    const coordinates = uv().sub(ray.mul(0.026)).mul(modules)
    const footprint = coordinates.fwidth().length().max(0.00035)
    const shimmer = ray.x.mul(2.3).add(ray.y.mul(0.24)).clamp(-2, 2)
    const constellation = stellarGraph({
      coordinate: coordinates,
      ray: ray.mul(modules).clamp(-2, 2),
      footprint,
      seconds: time,
      proximity,
      angle: shimmer,
    }) as Node<'vec3'>
    // Continuous object-space clouds have no UV seam and move independently of the star graph.
    const drift = vec3(time.mul(0.019), time.mul(-0.012), time.mul(0.008))
    const cloudPosition = p.mul(5.5).add(drift)
    const warp = mx_noise_float(cloudPosition).mul(1.8)
    const cloud = mx_noise_float(cloudPosition.mul(1.7).add(warp)).mul(0.5).add(0.5)
    const veil = cloud.smoothstep(0.32, 0.82)
    const interference = p.y.mul(5).add(p.z.mul(3)).add(grazing.mul(3)).add(time.mul(0.07)).sin().mul(0.5).add(0.5)
    const nebula = mix(color(hsl.integer(262, 89, 27)), color(hsl.integer(301, 69, 37)), interference)
    const aurora = mx_noise_float(cloudPosition.mul(vec3(0.6, 2.4, 1.1)).add(warp)).abs().smoothstep(0.06, 0.32).oneMinus().mul(veil)
    // A second, deeper star plane moves against the recognizable faces as the viewer walks around.
    const dustPosition = uv().sub(ray.mul(0.067)).mul(vec2(168, 24))
    const dustCell = dustPosition.floor().mod(vec2(168, 24))
    const dustRandom = cellNoiseVec3(vec3(dustCell, 13.7))
    const dustDelta = dustPosition.fract().sub(dustRandom.xy.mul(0.46).add(0.27))
    const dustDistance = dustDelta.length()
    const dustFootprint = dustPosition.fwidth().length().max(0.001)
    const dustRadius = float(0.035)
    const dust = dustDistance.smoothstep(dustRadius.sub(dustFootprint).max(0), dustRadius.add(dustFootprint).min(0.25)).oneMinus()
      .mul(dustRadius.div(dustRadius.add(dustFootprint)).pow2())
      .mul(dustRandom.z.smoothstep(0.74, 0.88))
      .mul(dustFootprint.smoothstep(0.15, 0.7).oneMinus())
    const dustTwinkle = time.mul(1.4).add(dustRandom.x.mul(30)).add(shimmer.mul(3)).sin().mul(0.3).add(0.7)
    this.colorNode = mix(color(hsl.integer(262, 66, 3)), color(hsl.integer(265, 52, 9)), veil.mul(0.3)).add(nebula.mul(0.008))
    this.metalness = 0.78
    this.roughnessNode = mix(float(0.24), float(0.34), cloud)
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.24
    this.specularIntensity = 0.5
    this.iridescence = 0.28
    this.iridescenceIOR = 1.36
    this.iridescenceThicknessNode = interference.mul(190).add(280)
    this.emissiveNode = constellation
      .add(nebula.mul(veil).mul(0.024))
      .add(color(hsl.integer(191, 85, 71)).mul(aurora).mul(0.025))
      .add(mix(color(hsl.integer(266, 100, 72)), color(hsl.integer(81, 100, 89)), dustRandom.x).mul(dust).mul(dustTwinkle).mul(proximity).mul(2.3))
      .add(mix(color(hsl.integer(274, 81, 35)), color(hsl.integer(194, 73, 74)), interference).mul(grazing.pow(4)).mul(0.15).mul(facing.smoothstep(0, 0.12)))
  }
}
