import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, normalLocal, positionLocal, time, uv, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Layered value noise in the −1…1 range of `mx_noise_float`, normalized by total amplitude. */
const fbm = (position: Node<'vec3'>, octaves = 3) => {
  let sum: Node<'float'> = float(0)
  let amplitude = 1
  let frequency = 1
  let norm = 0
  for (let octave = 0; octave < octaves; octave++) {
    sum = sum.add(mx_noise_float(position.mul(frequency)).mul(amplitude))
    norm += amplitude
    amplitude *= 0.55
    frequency *= 2.07
  }
  return sum.div(norm)
}
/** One layer of pigment sacs. The distance to the nearest sac center comes from a true Worley neighborhood search, so sacs overlap and interlock with no cell-boundary clipping. Regional swell patches make whole neighborhoods bloom together, and deeper layers get softer edges, as if seen through the epidermis above them. */
function chromatophore(q: Node<'vec3'>, drive: Node<'float'>, seed: number, speed: number, softness: number) {
  const nearest = mx_worley_noise_vec3(q, 1, 0).x
  const swell = mx_noise_float(q.mul(0.45).add(seed)).mul(0.5).add(0.5)
  const wave = time.mul(speed).add(swell.mul(16).add(seed)).sin().mul(0.5).add(0.5)
  const radius = float(0.14).add(drive.mul(wave.mul(0.45).add(0.55)).mul(0.42))
  const dist = nearest.add(mx_noise_float(q.mul(3.3).add(seed * 2.7)).mul(0.055))
  const aa = nearest.fwidth().max(0.01).add(softness)
  const fill = dist.smoothstep(radius.sub(aa), radius.add(aa)).oneMinus()
  const dome = dist.div(radius).pow2().oneMinus().max(0).sqrt()
  // Dormant sacs never vanish: a contracted pinprick remains in every neighborhood.
  const pin = dist.smoothstep(0.055, 0.085).oneMinus()
  return {
    dome,
    fill,
    pin,
  }
}

/** Living cephalopod skin. Three sizes of chromatophore — black-brown, rust red, amber — breathe at their own rates over a pale fleshy dermis. Dark “passing cloud” bands travel along the tube by swelling the great dark sacs in sequence, while the flank nearest the viewer flushes into a warning display: amber blooms open, papillae stand up, structural teal-violet iridophore light shows through the gaps and buried photophores twinkle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, rim, near, intimate} = viewerFrame()
    // Breathing silhouette: a slow traveling swell plus a faint whole-body pulse.
    const swellPhase = tube.x.mul(TAU * 3).sub(time.mul(1.9))
    this.positionNode = positionLocal.add(normalLocal.mul(swellPhase.sin().mul(0.0032).add(time.mul(0.85).sin().mul(0.0022))))
    // Excitement is local: the flank turned toward a close viewer alarms first.
    const mottle = fbm(p.mul(3.1)).mul(0.5).add(0.5)
    const grain = fbm(p.mul(11), 2).mul(0.5).add(0.5)
    const passing = swellPhase.add(mottle.mul(4.2)).sin().mul(0.5).add(0.5)
    const passingSharp = passing.pow(3.2)
    const proximity = intimate.mul(0.85).add(near.mul(0.4)).clamp()
    const heartbeat = time.mul(1.7).add(mottle.mul(9)).sin().mul(0.5).add(0.5).pow(3).mul(proximity)
    const excitement = proximity.mul(0.72).add(passingSharp.mul(0.42)).add(heartbeat.mul(0.35)).clamp()
    // Fleshy dermis: pale milky camouflage that deepens toward plum in a display.
    const calm = mix(mix(color(hsl.integer(72, 47, 60)), color(hsl.integer(86, 56, 90.6)), mottle), color(hsl.integer(88, 61, 93.6)), grain.mul(0.25))
    const calmDarkened = mix(calm, color(hsl.integer(56, 55, 29)), mottle.smoothstep(0.62, 0.92).mul(0.5))
    let skin = mix(calmDarkened, color(hsl.integer(338, 50, 22)), excitement.mul(0.28))
    // Chromatophores, largest and darkest first. The passing clouds are the dark layer
    // swelling in sequence; amber answers the viewer’s approach instead.
    // Each pigment layer floats at its own depth, deepest first, so sacs drift across
    // one another as the viewpoint moves.
    const darkCells = chromatophore(p.sub(view.mul(0.03)).mul(11), passingSharp.mul(0.9).add(proximity.mul(0.3)).clamp(), 3.7, 0.5, 0.035)
    const redCells = chromatophore(p.sub(view.mul(0.015)).mul(17), passingSharp.mul(0.55).add(proximity.mul(0.5)).add(0.04).clamp(), 11.3, 0.75, 0.04)
    const amberCells = chromatophore(p.mul(24), proximity.mul(0.8).add(heartbeat.mul(0.4)).add(0.1).clamp(), 23.9, 1.1, 0.03)
    skin = mix(skin, color(hsl.integer(50, 42, 9)), darkCells.fill.mul(darkCells.dome.mul(0.3).add(0.66)))
    skin = mix(skin, color(hsl.integer(38, 74, 15)), darkCells.pin.mul(0.55))
    skin = mix(skin, mix(color(hsl.integer(36, 88, 39)), color(hsl.integer(36, 93, 53.5)), excitement), redCells.fill.mul(redCells.dome.mul(0.3).add(0.62)))
    skin = mix(skin, color(hsl.integer(37, 79, 22)), redCells.pin.mul(0.5))
    skin = mix(skin, mix(color(hsl.integer(64, 83, 57)), color(hsl.integer(72.3, 100, 78.4)), excitement), amberCells.fill.mul(amberCells.dome.mul(0.35).add(0.5)))
    skin = mix(skin, color(hsl.integer(51, 82, 34)), amberCells.pin.mul(0.45))
    const coverage = darkCells.fill.max(redCells.fill).max(amberCells.fill)
    // A fine peppering of dormant pinpricks covers even the palest skin.
    const pepper = mx_worley_noise_vec3(p.mul(38), 1, 0).x.smoothstep(0.05, 0.09).oneMinus()
    skin = mix(skin, color(hsl.integer(48, 59, 12)), pepper.mul(coverage.mul(0.7).oneMinus()).mul(near.mul(0.65).add(0.35)).mul(0.5))
    // Iridophores lie beneath the pigment: sampled a little deeper along the view ray, they
    // shift teal-violet with angle and only show where the sacs leave gaps.
    const deep = p.sub(view.mul(0.04))
    const iridPhase = grazing.mul(1.7).add(deep.dot(vec3(0.7, 1.1, -0.5))).add(passing.mul(0.8))
    const irid = spectralColor(iridPhase)
    const iridClumps = mx_noise_float(deep.mul(6)).mul(0.5).add(0.5).smoothstep(0.4, 0.68)
    const iridStrength = grazing.pow(1.6).mul(excitement.mul(0.65).add(0.35)).mul(coverage.mul(0.9).oneMinus()).mul(iridClumps).clamp()
    skin = mix(skin, irid, iridStrength.mul(0.6))
    // Pale leucophore speckle, mostly where no pigment cell covers the skin.
    const speckle = cellularPoints(p.mul(46), 0.04, 0.2, 0.62)
    skin = mix(skin, color(hsl.integer(85, 37, 88)), speckle.mul(0.3).mul(coverage.oneMinus()))
    this.colorNode = skin
    this.metalness = 0
    this.roughnessNode = float(0.38).sub(iridStrength.mul(0.1)).add(coverage.mul(0.06)).max(0.14)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.16
    this.sheen = 0.35
    this.sheenRoughness = 0.55
    this.sheenColor.set(hsl.integer(52, 64, 66))
    this.iridescenceNode = excitement.mul(0.45).add(0.1)
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = mottle.mul(300).add(160)
    // Papillae stand up as the display intensifies; calm skin lies almost smooth.
    const height = darkCells.dome.mul(0.5).add(redCells.dome.mul(0.35)).add(amberCells.dome.mul(0.25)).add(grain.mul(0.2)).add(mx_noise_float(p.mul(60)).mul(0.12))
    this.normalNode = proceduralNormal(height, float(0.0024).add(excitement.mul(0.0018)))
    // Buried photophores and a warm rim of blood under thin skin, both only up close.
    const photophores = cellularPoints(p.mul(34).add(vec3(7.7, 3.1, 9.4)), 0.02, 0.13, 0.78)
    const twinkle = time.mul(2.5).add(mottle.mul(24)).sin().mul(0.4).add(0.6)
    this.emissiveNode = color(hsl.integer(181, 92, 84)).mul(photophores).mul(intimate.mul(1.7).add(passingSharp.mul(0.25))).mul(twinkle)
      .add(irid.mul(iridStrength).mul(near.mul(0.14).add(0.02)))
      .add(color(hsl.integer(47.5, 100, 68)).mul(amberCells.fill).mul(excitement).mul(0.2))
      .add(color(hsl.integer(43, 84, 38)).mul(rim).mul(near.mul(0.6).add(0.25)).mul(0.22))
  }
}
