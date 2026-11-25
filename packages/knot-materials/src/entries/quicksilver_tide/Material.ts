import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, normalLocal, select, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {panelSky, proceduralEnvironment} from '../../candidates/claude_sonnet/lib/environment.ts'
import {knotCircumference, knotFrame, knotLength, knotTubeRadius} from '../../candidates/claude_sonnet/lib/knotFrame.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const wrap01 = (x: Node<'float'>) => x.sub(x.add(0.5).floor())
/** Slow, vertex-resolved swell: beads and necks flow through the knot like a column of mercury under surface tension. */
const swell = (tube: Node<'vec2'>) => {
  const beat = tube.x.mul(TAU * 11).sub(time.mul(0.9))
  const bead = beat.cos().add(beat.mul(2).add(0.9).cos().mul(0.32))
  const envelope = tube.x.mul(TAU * 3).add(time.mul(0.21)).sin().mul(0.35).add(0.75)
  const lobe = tube.x.mul(TAU * 5).add(tube.y.mul(TAU * 2)).sub(time.mul(0.6)).sin().mul(0.0055)
  return bead.mul(envelope).mul(0.0165).add(lobe)
}
const dropCycle = 7
/** One droplet impact: an expanding wave packet with a small central splash, in world units. */
const dropRing = (tube: Node<'vec2'>, slot: number) => {
  const shifted = time.add(slot * dropCycle / 3)
  const id = shifted.div(dropCycle).floor()
  const age = shifted.sub(id.mul(dropCycle))
  const seed = cellNoiseVec3(vec3(id, slot * 3.7 + 0.5, 1.5))
  const du = wrap01(tube.x.sub(seed.x)).mul(knotLength)
  const dv = wrap01(tube.y.sub(seed.y)).mul(knotCircumference)
  const r = vec2(du, dv).length()
  const front = age.mul(0.3)
  const packet = r.sub(front).div(0.1).pow2().negate().exp()
  const wave = r.sub(front).mul(TAU / 0.075).cos()
  const life = age.mul(-0.42).exp().mul(age.smoothstep(0, 0.25))
  const splash = r.div(0.05).pow2().negate().exp().mul(age.mul(-2.6).exp()).mul(1.4)
  return packet.mul(wave).add(splash).mul(life)
}
/** Ring waves from droplets that keep landing on the metal, plus faint capillary chatter. Fragment-resolved only. */
const ripples = (tube: Node<'vec2'>) => {
  let height: Node<'float'> = float(0)
  for (let slot = 0;slot < 3;slot++) {
    height = height.add(dropRing(tube, slot).mul(0.0058))
  }
  const chatterA = tube.x.mul(TAU * 173).add(tube.y.mul(TAU * -6)).add(time.mul(2.1)).sin()
  const chatterB = tube.x.mul(TAU * -131).add(tube.y.mul(TAU * 9)).sub(time.mul(1.7)).sin()
  return height.add(chatterA.add(chatterB).mul(0.00042))
}
/** The displaced mercury surface; a numeric `detail` leaves out the fragment-only ripples. */
const surface = (at: Node<'vec2'>, detail: Node<'float'> | number) => {
  const {center, normal} = knotFrame(at)
  return center.add(normal.mul(swell(at).add(typeof detail === 'number' ? 0 : ripples(at).mul(detail)).add(knotTubeRadius)))
}

/** Liquid mercury in a mirrored gallery: beads of metal flow around the knot, droplets keep landing on it and a thin oil film swirls over the rings. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    const {grazing} = viewerFrame()
// Capillary detail fades out as it approaches pixel size, so distant metal stays calm instead of shimmering.
    const footprint = tube.x.fwidth().mul(knotLength)
    const resolved = footprint.smoothstep(0.012, 0.05).oneMinus()
    this.positionNode = surface(tube, 0)
    const eu = vec2(0.000012, 0)
    const ev = vec2(0, 0.00018)
    const du = surface(tube.add(eu), resolved).sub(surface(tube.sub(eu), resolved))
    const dv = surface(tube.add(ev), resolved).sub(surface(tube.sub(ev), resolved))
    const raw = du.cross(dv).normalize()
    const outward = select(raw.dot(normalLocal).greaterThan(0), raw, raw.negate())
    this.normalNode = transformNormalToView(outward).normalize()
    const sky = panelSky({
      zenith: [0.025, 0.045, 0.11],
      horizon: [0.34, 0.24, 0.2],
      nadir: [0.012, 0.011, 0.016],
      glow: {
        color: [1, 0.5, 0.22],
        intensity: 1.3,
        width: 0.14,
      },
      panels: [{
        azimuth: 0.75,
        elevation: 0.55,
        halfWidth: 0.42,
        halfHeight: 0.32,
        color: [1, 0.86, 0.66],
        intensity: 6,
        panes: [4, 3],
      }, {
        azimuth: -0.9,
        elevation: 0.5,
        halfWidth: 0.05,
        halfHeight: 0.55,
        color: [0.62, 0.82, 1],
        intensity: 7,
      }, {
        azimuth: 2.9,
        elevation: 0.15,
        halfWidth: 0.36,
        halfHeight: 0.05,
        color: [1, 0.25, 0.55],
        intensity: 4,
      }, {
        azimuth: -2.4,
        elevation: 0.9,
        halfWidth: 0.3,
        halfHeight: 0.06,
        color: [0.2, 1, 0.85],
        intensity: 3.5,
      }, {
        azimuth: 0,
        elevation: 1.35,
        halfWidth: 1.2,
        halfHeight: 0.25,
        color: [1, 1, 1],
        intensity: 1.2,
        softness: 0.5,
      }],
    })
    this.envNode = proceduralEnvironment(sky)
    this.colorNode = color(hsl.integer(262, 17, 87))
    this.metalness = 1
    this.roughnessNode = float(0.035).add(grazing.pow(3).mul(0.02))
    this.iridescence = 0.6
    this.iridescenceIOR = 1.8
    this.iridescenceThicknessNode = tube.x.mul(TAU * 7).add(tube.y.mul(TAU * 2)).add(time.mul(0.4)).sin().mul(0.5).add(0.5).mul(260).add(240)
  }
}
