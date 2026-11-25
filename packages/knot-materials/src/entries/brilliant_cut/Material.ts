import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, cos, float, modelWorldMatrix, normalLocal, normalWorld, reflect, refract, select, sin, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {panelSky, proceduralEnvironment, viewRayWorld} from '../../candidates/claude_sonnet/lib/environment.ts'
import {knotFrame, knotLength, knotTubeRadius} from '../../candidates/claude_sonnet/lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const sides = 8
const facetAngle = TAU / sides
/** Facets shift by this many positions over one lap of the knot; it must stay an integer so the cut closes on itself. */
const twistFacets = 6
/** Radius of the cylinder used to approximate the inside of the glass rod for the internal light paths. */
const innerRadius = knotTubeRadius * 0.96
const fmod = (x: Node<'float'>, y: number) => x.sub(x.div(y).floor().mul(y))
const twist = (u: Node<'float'>) => u.mul(facetAngle * twistFacets)
/** Radius of the twisted octagonal cross-section at a given angle: corners touch the original tube, faces are planar. */
const prismRadius = (theta: Node<'float'>, u: Node<'float'>) => {
  const inside = fmod(theta.sub(twist(u)), facetAngle)
  return cos(inside.sub(facetAngle / 2)).reciprocal().mul(knotTubeRadius * Math.cos(Math.PI / sides))
}
type Frame = ReturnType<typeof knotFrame>
/** One straight chord through the rod, ending on a facet. Returns the exit facet normal in object space. */
const chord = (frame: Frame, radial: Node<'vec3'>, direction: Node<'vec3'>, u: Node<'float'>) => {
  const {axis, frameNormal, binormal} = frame
  const along = direction.dot(axis)
  const perpendicular = direction.sub(axis.mul(along))
  const span = perpendicular.dot(perpendicular).max(0.0001)
  const length = radial.dot(perpendicular).mul(-2 * innerRadius).div(span).clamp(0, 0.7)
  const exitRadial = radial.add(perpendicular.mul(length.div(innerRadius))).normalize()
  const exitU = u.add(length.mul(along).div(knotLength))
  const theta = atan(exitRadial.dot(binormal), exitRadial.dot(frameNormal).negate())
  const phase = twist(exitU)
  const facet = fmod(theta.sub(phase), TAU).div(facetAngle).floor()
  const center = phase.add(facet.add(0.5).mul(facetAngle))
  const normal = frameNormal.mul(cos(center).negate()).add(binormal.mul(sin(center)))
  return {
    exitRadial,
    exitU,
    normal,
  }
}
/** Follow one wavelength through the rod: refract in, cross the glass, refract out, or reflect internally (total internal reflection) and try again. Returns the outgoing direction in object space. */
const throughRod = (frame: Frame, u: Node<'float'>, incident: Node<'vec3'>, entryNormal: Node<'vec3'>, ior: number) => {
  const inward = refract(incident, entryNormal, float(1 / ior))
  const first = chord(frame, frame.normal, inward, u)
  const outFirst = refract(inward, first.normal.negate(), float(ior))
  const bounced = reflect(inward, first.normal.negate())
  const second = chord(frame, first.exitRadial, bounced, first.exitU)
  const outSecond = refract(bounced, second.normal.negate(), float(ior))
  const rebounced = reflect(bounced, second.normal.negate())
  const escaped1 = outFirst.dot(outFirst).greaterThan(0.5)
  const escaped2 = outSecond.dot(outSecond).greaterThan(0.5)
  return select(escaped1, outFirst, select(escaped2, outSecond, rebounced)).normalize()
}
const rotateY = (direction: Node<'vec3'>, angle: Node<'float'>) => {
  const c = angle.cos()
  const s = angle.sin()
  return vec3(direction.x.mul(c).add(direction.z.mul(s)), direction.y, direction.z.mul(c).sub(direction.x.mul(s)))
}

/** A twisted octagonal rod of hobnail-cut lead crystal. Every ray is followed through the glass, once per color, so the room splits into spectra and the facets flash as you walk around. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    const {view} = viewerFrame()
    const frame = knotFrame(tube)
    const surface = (at: Node<'vec2'>) => {
      const {center, normal} = knotFrame(at)
      return center.add(normal.mul(prismRadius(at.y.mul(TAU), at.x)))
    }
    this.positionNode = surface(tube)
    const eu = vec2(0.00002, 0)
    const ev = vec2(0, 0.0002)
    const du = surface(tube.add(eu)).sub(surface(tube.sub(eu)))
    const dv = surface(tube.add(ev)).sub(surface(tube.sub(ev)))
    const raw = du.cross(dv).normalize()
    const facetNormal = select(raw.dot(normalLocal).greaterThan(0), raw, raw.negate())
// Hobnail pyramids: four tilted planes per diamond, staggered from face to face.
    const local = fmod(tube.y.mul(TAU).sub(twist(tube.x)), TAU).div(facetAngle)
    const facet = local.floor()
    const across = local.fract().mul(2).sub(1)
    const along = tube.x.mul(52).add(facet.mul(0.5)).fract().mul(2).sub(1)
    const dominance = across.abs().sub(along.abs())
    const acrossWeight = dominance.smoothstep(dominance.fwidth().negate().sub(0.01), dominance.fwidth().add(0.01))
    const tilt = frame.axis.mul(along.sign().mul(acrossWeight.oneMinus())).add(facetNormal.cross(frame.axis).normalize().mul(across.sign().mul(acrossWeight))).mul(0.3)
    const cutNormal = facetNormal.add(tilt).normalize()
    this.normalNode = transformNormalToView(cutNormal).normalize()
// A dim hall with hard emitters: rainbows need bright edges to split.
    const hall = panelSky({
      zenith: [0.003, 0.005, 0.02],
      horizon: [0.025, 0.018, 0.022],
      nadir: [0.002, 0.002, 0.004],
      glow: {
        color: [1, 0.62, 0.3],
        intensity: 0.25,
        width: 0.08,
      },
      panels: [{
        azimuth: 0.6,
        elevation: 0.6,
        halfWidth: 0.26,
        halfHeight: 0.22,
        color: [1, 0.9, 0.72],
        intensity: 8,
        panes: [3, 3],
      }, {
        azimuth: -0.85,
        elevation: 0.45,
        halfWidth: 0.035,
        halfHeight: 0.6,
        color: [0.75, 0.88, 1],
        intensity: 11,
      }, {
        azimuth: 2.4,
        elevation: 0.3,
        halfWidth: 0.5,
        halfHeight: 0.035,
        color: [1, 0.55, 0.35],
        intensity: 8,
      }, {
        azimuth: -2.5,
        elevation: 0.7,
        halfWidth: 0.16,
        halfHeight: 0.16,
        color: [0.62, 0.55, 1],
        intensity: 6,
      }, {
        azimuth: 0,
        elevation: 1.3,
        halfWidth: 0.7,
        halfHeight: 0.3,
        color: [1, 0.97, 0.92],
        intensity: 1.4,
        softness: 0.3,
      }, {
        azimuth: 1.5,
        elevation: -0.45,
        halfWidth: 0.9,
        halfHeight: 0.08,
        color: [0.9, 0.7, 0.5],
        intensity: 1.2,
      }],
    })
    const spin = time.mul(0.11)
    const spinning = (direction: Node<'vec3'>, blur: Node<'float'>) => hall(rotateY(direction, spin), blur)
    this.envNode = proceduralEnvironment(spinning)
    const worldOf = (direction: Node<'vec3'>) => direction.transformDirection(modelWorldMatrix).normalize()
    const incident = view.negate()
    const channel = (ior: number) => spinning(worldOf(throughRod(frame, tube.x, incident, cutNormal, ior)), float(0.01))
    const inside = vec3(channel(1.486).x, channel(1.53).y, channel(1.588).z)
    const cosine = cutNormal.dot(view).abs().clamp()
    const fresnel = cosine.oneMinus().pow(5).mul(0.955).add(0.045)
// Point lamps that circle the room: whole facets flash at once when the half-vector lines up.
    let scintillation: Node<'float'> = float(0)
    for (const lamp of [vec3(0.55, 0.65, 0.52), vec3(-0.7, 0.35, 0.62), vec3(0.1, 0.85, -0.5), vec3(-0.2, -0.3, 0.93)]) {
      const world = rotateY(lamp.normalize(), spin.negate())
      const half = world.sub(viewRayWorld).normalize()
      scintillation = scintillation.add(normalWorld.dot(half).clamp().pow(420))
    }
    this.colorNode = color(hsl.integer(0, 0, 0))
    this.metalness = 0
    this.roughness = 0.03
    this.ior = 1.55
    this.emissiveNode = inside.mul(fresnel.oneMinus()).mul(vec3(0.97, 0.99, 1)).add(color(hsl.integer(83, 100, 96.6)).mul(scintillation).mul(7))
  }
}
