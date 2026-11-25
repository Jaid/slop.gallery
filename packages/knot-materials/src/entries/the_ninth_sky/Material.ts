import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, texture, time, uv, vec2, vec3} from 'three/tsl'
import {ClampToEdgeWrapping, DataTexture, DataUtils, HalfFloatType, LinearFilter, NoColorSpace, RGBAFormat} from 'three/webgpu'

import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Hand-drawn star graphs, not silhouettes filled with random particles. Coordinates are tile-local. */
type Star = {
  eye: boolean
  phase: number
  radius: number
  x: number
  y: number
}
type Connection = {
  a: number
  b: number
  weight: number
}
type Constellation = {
  connections: Array<Connection>
  name: string
  stars: Array<Star>
}
type Point = readonly [number, number]

class StarChart {
  readonly connections: Array<Connection> = []
  readonly stars: Array<Star> = []
  private readonly labels = new Map<string, number>
  constructor(readonly name: string) {}
  build(): Constellation {
    return {
      name: this.name,
      stars: this.stars,
      connections: this.connections,
    }
  }
  path(names: string, weight = 1) {
    const ids = names.split(' ').map(name => {
      const id = this.labels.get(name)
      if (id === undefined) {
        throw new Error(`Unknown star: ${name}`)
      }
      return id
    })
    for (let i = 1; i < ids.length; i++) {
      this.connections.push({
        a: ids[i - 1],
        b: ids[i],
        weight,
      })
    }
    return this
  }
  star(name: string, [x, y]: Point, radius = 0.006, eye = false) {
    if (this.labels.has(name)) {
      throw new Error(`Duplicate star: ${name}`)
    }
    this.labels.set(name, this.stars.length)
    this.stars.push({
      x,
      y,
      radius,
      eye,
      phase: (0.46 - y) * 1.4 + Math.abs(x) * 0.6,
    })
    return this
  }
}
const sentinelChart = new StarChart('The sentinel')
const sentinel = sentinelChart
  .star('earL', [-0.25, 0.425], 0.009)
  .star('browL', [-0.075, 0.305])
  .star('browR', [0.07, 0.305])
  .star('earR', [0.235, 0.425], 0.009)
  .star('templeR', [0.215, 0.18])
  .star('cheekR', [0.155, 0.065])
  .star('chin', [0, 0.015], 0.0075)
  .star('cheekL', [-0.17, 0.065])
  .star('templeL', [-0.235, 0.18])
  .star('eyeL', [-0.115, 0.19], 0.009, true)
  .star('eyeR', [0.1, 0.19], 0.009, true)
  .star('nose', [-0.005, 0.105], 0.0075)
  .star('muzzleL', [-0.063, 0.065], 0.004)
  .star('muzzleR', [0.058, 0.065], 0.004)
  .star('whiskerLU', [-0.36, 0.135], 0.004)
  .star('whiskerLD', [-0.35, 0.035], 0.004)
  .star('whiskerRU', [0.345, 0.135], 0.004)
  .star('whiskerRD', [0.335, 0.035], 0.004)
  .star('shoulderL', [-0.135, -0.09])
  .star('shoulderR', [0.135, -0.09])
  .star('haunchL', [-0.225, -0.28], 0.008)
  .star('haunchR', [0.225, -0.28], 0.008)
  .star('heelL', [-0.2, -0.39])
  .star('heelR', [0.19, -0.39])
  .star('pawL', [-0.085, -0.395], 0.008)
  .star('pawR', [0.075, -0.395], 0.008)
  .star('chest', [-0.005, -0.15], 0.008)
  .star('ankleL', [-0.07, -0.29])
  .star('ankleR', [0.065, -0.29])
  .star('tail0', [0.31, -0.365])
  .star('tail1', [0.4, -0.26], 0.007)
  .star('tail2', [0.425, -0.125])
  .star('tail3', [0.375, -0.055], 0.007)
  .star('tail4', [0.305, -0.085], 0.009)
  .path('earL browL browR earR templeR cheekR chin cheekL templeL earL')
  .path('templeL eyeL nose eyeR templeR', 0.45)
  .path('nose muzzleL chin muzzleR nose')
  .path('whiskerLU cheekL whiskerLD', 0.65)
  .path('whiskerRU cheekR whiskerRD', 0.65)
  .path('cheekL shoulderL haunchL heelL pawL ankleL chest ankleR pawR heelR haunchR shoulderR cheekR')
  .path('chin chest', 0.6)
  .path('pawL pawR', 0.8)
  .path('heelR tail0 tail1 tail2 tail3 tail4')
  .build()
const dreamerChart = new StarChart('The dreamer')
const dreamer = dreamerChart
  .star('earL', [-0.35, 0.32], 0.009)
  .star('brow', [-0.18, 0.19])
  .star('earR', [-0.04, 0.33], 0.009)
  .star('templeR', [0.005, 0.065])
  .star('cheekR', [-0.045, -0.09])
  .star('chin', [-0.17, -0.13], 0.007)
  .star('cheekL', [-0.32, -0.065])
  .star('templeL', [-0.38, 0.1])
  .star('eyeLO', [-0.32, 0.08], 0.004)
  .star('eyeL', [-0.275, 0.045], 0.008, true)
  .star('eyeLI', [-0.23, 0.075], 0.004)
  .star('eyeRO', [-0.16, 0.075], 0.004)
  .star('eyeR', [-0.115, 0.04], 0.008, true)
  .star('eyeRI', [-0.07, 0.07], 0.004)
  .star('nose', [-0.2, -0.035], 0.007)
  .star('mouth', [-0.195, -0.09], 0.004)
  .star('whiskerL', [-0.43, -0.02], 0.004)
  .star('whiskerR', [-0.41, -0.13], 0.004)
  .star('back', [0.16, 0.21], 0.006)
  .star('rump', [0.32, 0.15], 0.008)
  .star('hip', [0.41, -0.025], 0.007)
  .star('heel', [0.38, -0.23], 0.006)
  .star('paw', [0.235, -0.34], 0.01)
  .star('base', [0.025, -0.36])
  .star('baseL', [-0.22, -0.3])
  .star('shoulder', [-0.33, -0.18])
  .star('tail0', [-0.04, -0.285])
  .star('tail1', [0.155, -0.235], 0.007)
  .star('tail2', [0.245, -0.09])
  .star('tail3', [0.18, 0.015], 0.006)
  .star('tail4', [0.075, -0.035])
  .star('tail5', [0.085, -0.15], 0.011)
  .path('earL brow earR templeR cheekR chin cheekL templeL earL')
  .path('eyeLO eyeL eyeLI', 0.8)
  .path('eyeRO eyeR eyeRI', 0.8)
  .path('nose mouth', 0.7)
  .path('whiskerL cheekL whiskerR', 0.6)
  .path('templeR back rump hip heel paw base baseL shoulder cheekL')
  .path('baseL tail0 tail1 tail2 tail3 tail4 tail5')
  .build()
const familiarChart = new StarChart('The familiar')
const familiar = familiarChart
  .star('earL', [-0.29, 0.4], 0.012)
  .star('earBaseL', [-0.115, 0.225], 0.006)
  .star('crown', [0, 0.24], 0.005)
  .star('earBaseR', [0.115, 0.225], 0.006)
  .star('earR', [0.29, 0.4], 0.012)
  .star('templeR', [0.325, 0.035], 0.006)
  .star('cheekR', [0.265, -0.185], 0.007)
  .star('jawR', [0.135, -0.275], 0.005)
  .star('chin', [0, -0.315], 0.009)
  .star('jawL', [-0.135, -0.275], 0.005)
  .star('cheekL', [-0.265, -0.185], 0.007)
  .star('templeL', [-0.325, 0.035], 0.006)
  .star('eyeLO', [-0.235, 0.07], 0.004)
  .star('eyeL', [-0.16, 0.045], 0.012, true)
  .star('eyeLI', [-0.09, 0.06], 0.004)
  .star('eyeRO', [0.235, 0.07], 0.004)
  .star('eyeR', [0.16, 0.045], 0.012, true)
  .star('eyeRI', [0.09, 0.06], 0.004)
  .star('nose', [0, -0.075], 0.009)
  .star('mouth', [0, -0.16], 0.004)
  .star('mouthL', [-0.065, -0.19], 0.005)
  .star('mouthR', [0.065, -0.19], 0.005)
  .star('rootL', [-0.085, -0.12], 0.004)
  .star('rootR', [0.085, -0.12], 0.004)
  .star('whiskerLU', [-0.425, -0.02], 0.004)
  .star('whiskerLM', [-0.435, -0.14], 0.004)
  .star('whiskerLD', [-0.395, -0.255], 0.004)
  .star('whiskerRU', [0.425, -0.02], 0.004)
  .star('whiskerRM', [0.435, -0.14], 0.004)
  .star('whiskerRD', [0.395, -0.255], 0.004)
  .path('earL earBaseL crown earBaseR earR templeR cheekR jawR chin jawL cheekL templeL earL')
  .path('eyeLO eyeL eyeLI', 0.85)
  .path('eyeRO eyeR eyeRI', 0.85)
  .path('eyeLI nose eyeRI', 0.3)
  .path('nose mouth mouthL', 0.8)
  .path('mouth mouthR', 0.8)
  .path('whiskerLU rootL whiskerLM', 0.7)
  .path('rootL whiskerLD', 0.6)
  .path('whiskerRU rootR whiskerRM', 0.7)
  .path('rootR whiskerRD', 0.6)
  .build()
const constellations: ReadonlyArray<Constellation> = [familiar, sentinel, dreamer]
/** Distance and arrival-time fields allow animated graphs with one texture read, not dozens of segment tests per fragment. */
function sampleChart(chart: Constellation, x: number, y: number): [number, number, number, number] {
  let lineDistanceSquared = 4
  let arrival = 0
  for (const edge of chart.connections) {
    const a = chart.stars[edge.a]
    const b = chart.stars[edge.b]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)))
    const ex = x - a.x - dx * t
    const ey = y - a.y - dy * t
    const d2 = (ex * ex + ey * ey) / (edge.weight * edge.weight)
    if (!(d2 < lineDistanceSquared)) {
      continue
    }
    lineDistanceSquared = d2
    arrival = a.phase + (b.phase - a.phase) * t
  }
  let starDistance = 2
  let identity = 0
  for (let index = 0; index < chart.stars.length; index++) {
    const star = chart.stars[index]
    const dx = x - star.x
    const dy = y - star.y
    const d = Math.hypot(dx, dy) - star.radius
    if (!(d < starDistance)) {
      continue
    }
    starDistance = d
    identity = star.eye ? 1.5 : index * 0.61803398875 % 1 * 0.9
  }
  return [Math.sqrt(lineDistanceSquared), starDistance, arrival, identity]
}
/** Linear half-float data, not color. Every material owns and releases its atlas. */
class StarAtlas extends DataTexture {
  constructor(size = 512) {
    if (!Number.isSafeInteger(size) || size < 16 || size > 2048) {
      throw new RangeError('Star atlas size must be an integer between 16 and 2048.')
    }
    const width = size * constellations.length
    const data = new Uint16Array(width * size * 4)
    for (const [tile, constellation] of constellations.entries()) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const fields = sampleChart(constellation, (x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5)
          const offset = (y * width + tile * size + x) * 4
          for (let c = 0; c < 4; c++) {
            data[offset + c] = DataUtils.toHalfFloat(fields[c])
          }
        }
      }
    }
    super(data, width, size, RGBAFormat, HalfFloatType)
    this.name = 'The Ninth Sky – graph distance and arrival-time atlas'
    this.colorSpace = NoColorSpace
    this.wrapS = ClampToEdgeWrapping
    this.wrapT = ClampToEdgeWrapping
    this.minFilter = LinearFilter
    this.magFilter = LinearFilter
    this.generateMipmaps = false
    this.needsUpdate = true
  }
}

/** A celestial bestiary under blue spinel: distinct star graphs, traveling signals and a deeper, parallax-separated sky. */
export default class extends KnotMaterial {
  private readonly atlas = new StarAtlas

  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const ray = tubeRay()
    // Integer lattice frequencies and periodic identities make both torus UV seams continuous.
    const period = vec2(16, 3)
    const chartUV = uv().add(ray.mul(0.012))
    const lattice = chartUV.mul(period)
    const cell = lattice.floor()
    const wrapped = cell.mod(period).add(period).mod(period)
    const identity = cellNoiseVec3(vec3(wrapped, 17))
    const slot = wrapped.x.add(wrapped.y.mul(2)).mod(4)
    const variant = slot.mod(2).mul(slot.div(2).floor().add(1))
    const local = lattice.fract().sub(0.5)
    const breath = time.mul(1.15).add(identity.x.mul(TAU)).sin()
    const q = vec2(local.x.mul(1.35), local.y.div(breath.mul(0.014).add(1)))
    // A restrained tail sway; the face and paws remain anchored instead of sliding across the surface.
    const sway = q.x.smoothstep(0.22, 0.42).mul(q.y.smoothstep(-0.4, 0.05)).mul(time.mul(0.85).add(identity.y.mul(TAU)).sin()).mul(0.017)
    const chartPoint = vec2(q.x.add(sway), q.y)
    const sampleUV = chartPoint.add(0.5).clamp(0.001, 0.999)
    const fields = texture(this.atlas, vec2(sampleUV.x.add(variant).div(constellations.length), sampleUV.y)).level(float(0))
    const footprint = lattice.fwidth().length().mul(0.65).max(0.0008)
    const inside = q.x.abs().max(q.y.abs()).smoothstep(0.46, 0.5).oneMinus()
    const detail = footprint.smoothstep(0.014, 0.075).oneMinus()
    const lineWidth = float(0.0021)
    const lines = fields.r.smoothstep(lineWidth, lineWidth.add(footprint)).oneMinus().mul(lineWidth.mul(2).div(footprint).min(1)).mul(inside)
    const lineHalo = fields.r.mul(-100).exp().mul(inside)
    const stars = fields.g.smoothstep(footprint.negate(), footprint).oneMinus().mul(inside)
    const starHalo = fields.g.max(0).mul(-85).exp().mul(inside)
    const eyes = fields.a.smoothstep(1.05, 1.3)
    const slowBlink = time.mul(0.48).add(identity.z.mul(TAU)).sin().smoothstep(0.989, 0.999)
    const eyelight = eyes.mul(slowBlink).mul(0.87).oneMinus()
    const twinkle = fields.a.mul(17).add(time.mul(1.7)).add(identity.x.mul(9)).sin().mul(0.18).add(0.82)
    // Arrival times interpolate along each actual connection, so waves trace ears → chest → paws and tail.
    const pulse = fields.b.mul(1.25).sub(time.mul(0.36)).add(identity.z).fract().sub(0.5).abs().smoothstep(0.035, 0.11).oneMinus()
    const attention = facing.pow(3).mul(near).mul(0.55).add(0.7)
    const viewTint = view.x.mul(0.45).add(view.z.mul(0.3)).add(grazing.mul(0.45)).add(0.3).clamp()
    const ice = mix(color(hsl.integer(216, 67, 77)), color(hsl.integer(284, 100, 73)), viewTint.mul(0.7))
    const starTint = mix(color(hsl.integer(229, 100, 91.3)), color(hsl.integer(77, 100, 86)), fields.a.smoothstep(0.52, 0.86))
    const connections = ice.mul(lines).mul(pulse.mul(0.85).add(0.62)).mul(attention)
    const magnitude = fields.a.clamp().pow(2).mul(0.75).add(0.45)
    const pinpoints = starTint.mul(stars).mul(magnitude).mul(twinkle).mul(eyelight).mul(pulse.mul(0.6).add(1.75))
    const halation = starTint.mul(starHalo).mul(magnitude).mul(0.18).add(ice.mul(lineHalo).mul(0.045))
    // A second optical stratum moves farther than the cats, revealing depth on every change of view.
    const deepUV = uv().add(ray.mul(0.055)).mul(vec2(144, 24))
    const dustId = cellNoiseVec3(vec3(deepUV.floor().mod(vec2(144, 24)).add(vec2(144, 24)).mod(vec2(144, 24)), 53))
    const dustD = deepUV.fract().sub(dustId.xy.mul(0.56).add(0.22)).length()
    const dustFoot = deepUV.fwidth().length().max(0.001)
    const dust = dustD.smoothstep(0.025, dustFoot.mul(0.6).add(0.065)).oneMinus()
      .mul(dustId.z.smoothstep(0.69, 0.86)).mul(dustFoot.smoothstep(0.25, 1.1).oneMinus())
    const scintillation = time.mul(0.6).add(dustId.x.mul(24)).sin().mul(0.25).add(0.75)
    const deepStars = mix(color(hsl.integer(243, 65, 57)), color(hsl.integer(262, 100, 86)), dustId.y).mul(dust).mul(scintillation).mul(intimate.mul(0.45).add(0.12))
    // Broken, fine orbital arcs frame the bestiary without enclosing it in rigid repeated badges.
    const orbitQ = vec2(q.x.mul(0.82), q.y)
    const orbitDistance = orbitQ.length().sub(0.465).abs()
    const orbit = orbitDistance.smoothstep(0.0009, footprint.add(0.0009)).oneMinus()
      .mul(float(0.0018).div(footprint).min(1)).mul(q.x.mul(13).add(q.y.mul(19)).sin().smoothstep(-0.25, 0.3)).mul(inside).mul(detail)
    const threadPhase = chartUV.y.mul(TAU * 2).add(chartUV.x.mul(TAU * 6).sin().mul(0.45))
    const threadDistance = threadPhase.sin().abs()
    const thread = threadDistance.smoothstep(0.008, threadDistance.fwidth().add(0.012)).oneMinus()
    const threadDashes = chartUV.x.mul(TAU * 180).sin().smoothstep(0.55, 0.8)
    const orbitLight = color(hsl.integer(85, 31, 65)).mul(orbit).mul(0.12)
      .add(color(hsl.integer(250, 53, 54)).mul(thread).mul(threadDashes).mul(detail).mul(0.055))
    const cloud = mx_noise_float(p.sub(view.mul(0.08)).mul(6).add(vec3(0, time.mul(0.018), 0))).mul(0.5).add(0.5)
    const body = mix(color(hsl.integer(256, 66, 8)), color(hsl.integer(242, 68, 21)), cloud)
    const velvet = mix(color(hsl.integer(244, 77, 32)), color(hsl.integer(292, 61, 30)), cloud.mul(0.65).add(viewTint.mul(0.35)))
    const buriedVeil = velvet.mul(cloud.pow(2)).mul(0.19)
    // Four-point optical wakes on the familiar’s two alpha stars; finite, footprint-filtered cores.
    const diffraction = (x: number) => {
      const d = chartPoint.sub(vec2(x, 0.4)).abs()
      const horizontal = d.y.smoothstep(0.0007, footprint.add(0.0007)).oneMinus().mul(d.x.mul(-65).exp())
      const vertical = d.x.smoothstep(0.0007, footprint.add(0.0007)).oneMinus().mul(d.y.mul(-40).exp())
      return horizontal.add(vertical).mul(float(0.002).div(footprint).min(1))
    }
    const alphaWakes = diffraction(-0.29).add(diffraction(0.29)).mul(variant.lessThan(0.5).select(1, 0)).mul(detail).mul(twinkle).mul(0.6)
    this.colorNode = body
    this.metalness = 0.82
    this.roughness = 0.29
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.28
    this.specularIntensity = 0.32
    this.ior = 1.48
    this.iridescenceNode = grazing.pow(2).mul(0.24)
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = cloud.mul(100).add(280)
    this.emissiveNode = connections.add(pinpoints).add(halation).add(deepStars).add(orbitLight).add(buriedVeil)
      .add(color(hsl.integer(233, 100, 88)).mul(alphaWakes))
      .add(mix(color(hsl.integer(253, 76, 25)), color(hsl.integer(290, 58, 28)), viewTint).mul(grazing.pow(3)).mul(0.24))
      .add(color(hsl.integer(244, 79, 16)).mul(cloud).mul(0.12))
  }

  override dispose() {
    this.atlas.dispose()
    super.dispose()
  }
}
