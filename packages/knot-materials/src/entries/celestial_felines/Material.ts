import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type SegmentData = {
  ax: number
  ay: number
  bax: number
  bay: number
  invLenSq: number
}

function compileSegments(nodes: Array<[number, number]>, lines: Array<[number, number]>): Array<SegmentData> {
  return lines.map(([i, j]) => {
    const a = nodes[i]
    const b = nodes[j]
    const bax = b[0] - a[0]
    const bay = b[1] - a[1]
    const lenSq = bax * bax + bay * bay
    return {
      ax: a[0],
      ay: a[1],
      bax,
      bay,
      invLenSq: lenSq > 1e-6 ? 1 / lenSq : 0,
    }
  })
}
// Cat 1: Prowling Celestial Hunter
const cat1Nodes: Array<[number, number]> = [
  [0.78, 0.5],
  [0.74, 0.44],
  [0.72, 0.55],
  [0.69, 0.53],
  [0.73, 0.6],
  [0.77, 0.76],
  [0.69, 0.63],
  [0.64, 0.74],
  [0.66, 0.58],
  [0.61, 0.49],
  [0.58, 0.38],
  [0.54, 0.47],
  [0.6, 0.28],
  [0.63, 0.16],
  [0.53, 0.26],
  [0.5, 0.15],
  [0.43, 0.55],
  [0.34, 0.54],
  [0.28, 0.48],
  [0.29, 0.36],
  [0.33, 0.24],
  [0.34, 0.14],
  [0.23, 0.25],
  [0.2, 0.14],
  [0.24, 0.51],
  [0.17, 0.57],
  [0.13, 0.68],
  [0.17, 0.81],
]
const cat1Lines: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 9],
  [2, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 3],
  [4, 6],
  [8, 6],
  [6, 9],
  [9, 10],
  [9, 11],
  [10, 11],
  [10, 12],
  [12, 13],
  [11, 14],
  [14, 15],
  [11, 16],
  [16, 17],
  [17, 18],
  [10, 19],
  [19, 18],
  [18, 19],
  [19, 20],
  [20, 21],
  [18, 22],
  [22, 23],
  [18, 24],
  [24, 25],
  [25, 26],
  [26, 27],
]
const cat1Eyes = [2, 3]
const cat1Whiskers: Array<[number, number]> = [[0.86, 0.56], [0.88, 0.5], [0.86, 0.44], [0.84, 0.38]]
// Cat 2: Leaping Cosmic Starlight
const cat2Nodes: Array<[number, number]> = [
  [0.85, 0.68],
  [0.81, 0.61],
  [0.78, 0.71],
  [0.75, 0.69],
  [0.79, 0.74],
  [0.81, 0.86],
  [0.76, 0.77],
  [0.72, 0.84],
  [0.73, 0.73],
  [0.71, 0.63],
  [0.67, 0.54],
  [0.64, 0.6],
  [0.76, 0.48],
  [0.88, 0.45],
  [0.7, 0.43],
  [0.8, 0.38],
  [0.55, 0.63],
  [0.44, 0.6],
  [0.34, 0.54],
  [0.33, 0.42],
  [0.24, 0.38],
  [0.16, 0.32],
  [0.27, 0.3],
  [0.19, 0.22],
  [0.3, 0.58],
  [0.22, 0.68],
  [0.14, 0.76],
  [0.08, 0.82],
]
const cat2Lines: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 9],
  [2, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 3],
  [4, 6],
  [8, 6],
  [6, 9],
  [9, 10],
  [9, 11],
  [10, 11],
  [10, 12],
  [12, 13],
  [11, 14],
  [14, 15],
  [11, 16],
  [16, 17],
  [17, 18],
  [10, 19],
  [19, 18],
  [18, 19],
  [19, 20],
  [20, 21],
  [18, 22],
  [22, 23],
  [18, 24],
  [24, 25],
  [25, 26],
  [26, 27],
]
const cat2Eyes = [2, 3]
const cat2Whiskers: Array<[number, number]> = [[0.92, 0.73], [0.94, 0.68], [0.92, 0.62]]
// Cat 3: Curled Celestial Sleeper
const cat3Nodes: Array<[number, number]> = [
  [0.42, 0.38],
  [0.45, 0.34],
  [0.46, 0.44],
  [0.43, 0.45],
  [0.48, 0.51],
  [0.46, 0.6],
  [0.51, 0.53],
  [0.56, 0.58],
  [0.55, 0.49],
  [0.58, 0.44],
  [0.54, 0.38],
  [0.36, 0.34],
  [0.38, 0.28],
  [0.64, 0.54],
  [0.72, 0.46],
  [0.68, 0.34],
  [0.58, 0.28],
  [0.48, 0.28],
  [0.7, 0.3],
  [0.58, 0.18],
  [0.32, 0.22],
  [0.26, 0.36],
]
const cat3Lines: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [2, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 3],
  [4, 6],
  [8, 6],
  [6, 9],
  [9, 10],
  [0, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [10, 16],
  [16, 17],
  [15, 16],
  [15, 18],
  [18, 19],
  [19, 20],
  [20, 21],
]
const cat3Eyes = [2, 3]
const cat3Whiskers: Array<[number, number]> = [[0.36, 0.42], [0.35, 0.38], [0.37, 0.34]]
const cat1Segments = compileSegments(cat1Nodes, cat1Lines)
const cat2Segments = compileSegments(cat2Nodes, cat2Lines)
const cat3Segments = compileSegments(cat3Nodes, cat3Lines)
function segmentDistance(p: Node<'vec2'>, s: SegmentData) {
  const pa = p.sub(vec2(s.ax, s.ay))
  const ba = vec2(s.bax, s.bay)
  const h = pa.dot(ba).mul(s.invLenSq).clamp(0, 1)
  return pa.sub(ba.mul(h)).length()
}
function evaluateConstellation(p: Node<'vec2'>, nodes: Array<[number, number]>, segments: Array<SegmentData>, eyes: Array<number>, whiskers: Array<[number, number]>) {
  let minLine: Node<'float'> = float(10)
  for (const s of segments) {
    minLine = minLine.min(segmentDistance(p, s))
  }
  let minNode: Node<'float'> = float(10)
  for (const [x, y] of nodes) {
    minNode = minNode.min(p.sub(vec2(x, y)).length())
  }
  let minEye: Node<'float'> = float(10)
  for (const idx of eyes) {
    const [x, y] = nodes[idx]
    minEye = minEye.min(p.sub(vec2(x, y)).length())
  }
  let minWhisker: Node<'float'> = float(10)
  const nose = nodes[0]
  for (const [wx, wy] of whiskers) {
    const bax = wx - nose[0]
    const bay = wy - nose[1]
    const lenSq = bax * bax + bay * bay
    const s: SegmentData = {
      ax: nose[0],
      ay: nose[1],
      bax,
      bay,
      invLenSq: lenSq > 1e-6 ? 1 / lenSq : 0,
    }
    minWhisker = minWhisker.min(segmentDistance(p, s))
  }
  return {
    minLine,
    minNode,
    minEye,
    minWhisker,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, facing, grazing, rim, near} = viewerFrame()
    const tube = uv()
// Three cat sectors along the knot tube
    const sectorFloat = tube.x.mul(3)
    const sectorId = sectorFloat.floor().mod(3)
    const localU = sectorFloat.fract()
    const localV = tube.y
    const localP = vec2(localU, localV)
    const c1 = evaluateConstellation(localP, cat1Nodes, cat1Segments, cat1Eyes, cat1Whiskers)
    const c2 = evaluateConstellation(localP, cat2Nodes, cat2Segments, cat2Eyes, cat2Whiskers)
    const c3 = evaluateConstellation(localP, cat3Nodes, cat3Segments, cat3Eyes, cat3Whiskers)
    const is0 = sectorId.equal(0)
    const is1 = sectorId.equal(1)
    const lineDist = is0.select(c1.minLine, is1.select(c2.minLine, c3.minLine))
    const nodeDist = is0.select(c1.minNode, is1.select(c2.minNode, c3.minNode))
    const eyeDist = is0.select(c1.minEye, is1.select(c2.minEye, c3.minEye))
    const whiskerDist = is0.select(c1.minWhisker, is1.select(c2.minWhisker, c3.minWhisker))
// Luminous stellar dots and diffraction spikes
    const starCore = nodeDist.mul(-90).exp()
    const starGlow = nodeDist.mul(-22).exp().mul(0.6)
    const starDots = starCore.add(starGlow)
// James Webb / Hubble 4-point cross diffraction spikes on stars
    const dU = localP.x.fract().sub(0.5).abs()
    const dV = localP.y.fract().sub(0.5).abs()
    const spikeCross = float(1).sub(dU.mul(35)).clamp(0, 1).mul(float(1).sub(dV.mul(5)).clamp(0, 1))
      .add(float(1).sub(dV.mul(35)).clamp(0, 1).mul(float(1).sub(dU.mul(5)).clamp(0, 1)))
    const starSpikes = spikeCross.mul(starCore).mul(near.mul(1.5).add(0.5))
// Constellation lines with traveling starlight energy pulses
    const lineCore = lineDist.mul(-110).exp()
    const lineGlow = lineDist.mul(-24).exp().mul(0.45)
    const pulseWave = tube.x.mul(TAU * 5).sub(time.mul(3.2)).sin().mul(0.5).add(0.5)
    const linePulses = lineCore.mul(pulseWave.pow(3)).mul(near.mul(0.8).add(0.4))
    const constellationLines = lineCore.add(lineGlow).add(linePulses)
// Whiskers: ultra-fine delicate starlight lines
    const whiskerCore = whiskerDist.mul(-180).exp().mul(near.mul(0.9).add(0.1))
// Cat eyes: twin stellar beacons that gaze at the camera
    const eyeCore = eyeDist.mul(-120).exp()
    const eyeGlow = eyeDist.mul(-28).exp()
    const eyePupilGleam = facing.pow(3).mul(time.mul(1.8).sin().mul(0.2).add(0.8))
    const catEyes = eyeCore.mul(2.2).add(eyeGlow).mul(eyePupilGleam)
// Cosmic nebular dust swirling inside the knot
    const nebulaNoise = mx_noise_float(p.mul(6.5).add(vec3(time.mul(0.04), time.mul(-0.03), time.mul(0.02))))
    // The palette uses turns: whole cycles join the nebula at the UV wrap.
    const nebulaHue = nebulaNoise.mul(0.7).add(tube.x.mul(2))
    const nebulaTint = cosinePalette(nebulaHue, [0.3, 0.2, 0.45], [0.35, 0.25, 0.4], [1, 1, 1], [0.1, 0.35, 0.7])
    const nebulaGlow = nebulaNoise.smoothstep(0.15, 0.75).mul(0.38)
// Distant micro-starfield
    const microStars = starfield(p, 55, 0.965).mul(0.5)
// Color synthesis
    const deepSpaceVoid = mix(color(hsl.integer(270, 42, 3)), color(hsl.integer(271, 59, 7)), nebulaNoise.mul(0.5).add(0.5))
    const constellationColor = mix(color(hsl.integer(250, 100, 78)), color(hsl.integer(247, 100, 92.3)), starDots)
    const eyeTint = mix(color(hsl.integer(161, 100, 86.9)), color(hsl.integer(96, 100, 89)), facing)
    const whiskerColor = color(hsl.integer(254, 100, 85))
    this.colorNode = deepSpaceVoid.add(nebulaTint.mul(nebulaGlow))
    this.metalness = 0.1
    this.roughness = 0.18
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.iridescence = 0.35
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = grazing.mul(300).add(150)
// Procedural normal mapping for subtle celestial glass relief
    const relief = lineCore.mul(0.002).add(starCore.mul(0.004))
    this.normalNode = proceduralNormal(relief, 0.8)
// Radiant emissive synthesis
    this.emissiveNode = constellationColor.mul(constellationLines).mul(1.4)
      .add(color(hsl.integer(0, 0, 100)).mul(starDots).mul(2.4))
      .add(color(hsl.integer(242, 100, 91)).mul(starSpikes).mul(1.8))
      .add(eyeTint.mul(catEyes).mul(3.5))
      .add(whiskerColor.mul(whiskerCore).mul(1.2))
      .add(nebulaTint.mul(nebulaGlow).mul(near.mul(0.5).add(0.6)))
      .add(microStars.mul(near.mul(0.6).add(0.5)))
      .add(color(hsl.integer(268.5, 100, 50)).mul(rim).mul(0.25))
  }
}
