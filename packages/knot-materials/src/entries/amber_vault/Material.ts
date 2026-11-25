import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, luminance, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {environmentRadiance} from '../../candidates/claude_opus/lib/environmentRadiance.ts'
import {pixelFootprint} from '../../candidates/claude_opus/lib/footprint.ts'
import {tubeInterior} from '../../candidates/claude_opus/lib/tubeInterior.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type Stratum = {
  depth: number
  scale: number
  seed: number
}
/** Absorption of Baltic amber per object unit: red passes, blue drowns. */
const absorption = vec3(5.5, 17, 52)
/** Baltic amber with inclusions. A refracted ray crosses the resin; along it, strata of sun spangles (disc-shaped stress fractures that flare when their plane mirrors a light toward you), trapped air bubbles and drifting plant dust sit at true parallax depths. Thin rims glow lemon, the thick core deepens to cognac, and the gallery light behind the knot shines through it. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {objectDistance, facing} = viewerFrame()
    const near = objectDistance.smoothstep(1, 2.4).oneMinus()
    const pixel = pixelFootprint().balanced
// a gentle index keeps parallax honest while thin rims stay thin enough to glow
    const interior = tubeInterior({
      ior: 1.15,
      maxChord: 0.4,
    })
    const {direction, chord, entry} = interior
// a low sun wheels slowly around the reliquary
    const sunAngle = time.mul(0.07).add(0.6)
    const sun = vec3(sunAngle.cos(), float(0.55), sunAngle.sin()).normalize()
// resin poured in layers: flow lines modulate density along the ray
    const flow = mx_fractal_noise_float(entry.mul(vec3(3, 9, 3)).add(direction.mul(0.3)), 3, 2, 0.5)
    const density = flow.mul(0.22).add(1)
    const transmittance = (distance: Node<'float'> | number) => absorption.mul(density).mul(distance).negate().exp()
// light from behind: the gallery seen through the resin, reddened by the path length
    const exitDirection = direction.refract(interior.frame.normal.negate(), 1.54).normalize()
    const behind = luminance(environmentRadiance(environment, exitDirection, 0.6))
    const backlight = vec3(1, 0.93, 0.8).mul(behind.div(behind.add(1.2)).mul(1.6).add(0.3)).mul(transmittance(chord.add(0.035)))
// forward scattering of the sun and ambient light within the resin
    const inscatterPhase = direction.dot(sun).max(0).pow(2).mul(0.5).add(0.45)
    const inscatter = vec3(1, 0.3, 0.03).mul(chord.mul(3)).mul(transmittance(chord.mul(0.25))).mul(inscatterPhase).mul(0.3)
    let light: Node<'vec3'> = backlight.add(inscatter)
    let veil: Node<'float'> = float(1)
    const strata = (stratum: Stratum) => {
      const present = chord.greaterThan(stratum.depth).select(float(1), float(0))
      const position = interior.sample(stratum.depth).position
      const lattice = position.mul(stratum.scale)
      const cell = lattice.floor()
      const identity = cellNoiseVec3(cell.add(stratum.seed))
      const shape = cellNoiseVec3(cell.add(stratum.seed + 41.7))
// feature center relative to the sample, in cell units
      const center = identity.mul(0.44).add(0.28).sub(lattice.fract())
      const footprint = pixel.mul(stratum.scale)
      const resolved = footprint.smoothstep(0.25, 0.8).oneMinus()
      const reach = transmittance(stratum.depth)
// sun spangle: a true disc on a random stress plane, intersected by the viewing ray
      const plane = shape.mul(2).sub(1).normalize()
      const along = center.dot(plane).div(direction.dot(plane).abs().max(0.08).mul(direction.dot(plane).sign()))
      const hit = direction.mul(along).sub(center)
      const spangleSize = shape.x.mul(0.08).add(0.12)
      const hitRadius = hit.length()
      const isSpangle = identity.x.step(0.72)
      const window = along.abs().smoothstep(0.6, 0.4)
      const spangle = hitRadius.smoothstep(spangleSize, spangleSize.sub(footprint.max(0.012))).mul(isSpangle).mul(window).mul(resolved)
      const tangentA = plane.cross(vec3(0.3, 1, 0.5)).normalize()
      const tangentB = plane.cross(tangentA)
      const spokeAngle = atan(hit.dot(tangentB), hit.dot(tangentA))
      const spokes = spokeAngle.mul(11).add(shape.z.mul(TAU)).sin().abs().pow(8).mul(0.7).add(hitRadius.div(spangleSize).pow(4).mul(0.9)).add(0.2)
      const mirror = sun.sub(direction).normalize()
      const sunGlint = plane.dot(mirror).abs().pow(60).mul(12)
      const galleryGlint = luminance(environmentRadiance(environment, direction.reflect(plane), 0.15)).pow(1.6).mul(0.7)
      const spangleLight = vec3(1, 0.66, 0.2).mul(sunGlint.add(galleryGlint).add(0.04)).mul(spokes).mul(spangle)
// trapped air: a sphere seen as a bright meniscus ring around a clearer core
      const impact = center.cross(direction).length()
      const bubbleSize = shape.y.mul(0.06).add(0.03)
      const isBubble = identity.x.step(0.5).oneMinus().mul(identity.y.step(0.6))
      const bubbleEdge = impact.div(bubbleSize)
      const bubble = bubbleEdge.smoothstep(1, footprint.div(bubbleSize).max(0.1).oneMinus()).mul(isBubble).mul(resolved).mul(center.dot(direction).abs().smoothstep(0.6, 0.4))
      const bubbleLight = vec3(1, 0.85, 0.6).mul(bubble).mul(bubbleEdge.pow(6).mul(0.9).add(0.06)).mul(galleryGlint.add(0.35)).mul(near.mul(0.6).add(0.4))
// plant dust: dark motes that shade whatever lies deeper
      const moteSize = shape.z.mul(0.05).add(0.025)
      const isMote = identity.x.step(0.5).oneMinus().mul(identity.y.step(0.6).oneMinus()).mul(identity.z.step(0.3))
      const mote = impact.smoothstep(moteSize, moteSize.mul(0.3)).mul(isMote).mul(resolved).mul(present).mul(center.dot(direction).abs().smoothstep(0.6, 0.4))
// plant fibres: slender curling threads, dark against the glow
      const fibreAxis = cellNoiseVec3(cell.add(stratum.seed + 90.1)).mul(2).sub(1).normalize()
      const centerFlat = center.sub(direction.mul(center.dot(direction)))
      const axisFlat = fibreAxis.sub(direction.mul(fibreAxis.dot(direction)))
      const fibreLength = shape.y.mul(0.2).add(0.14)
      const reachAlong = centerFlat.dot(axisFlat).negate().div(axisFlat.dot(axisFlat).max(0.0001)).clamp(fibreLength.negate(), fibreLength)
      const curl = axisFlat.cross(direction).mul(reachAlong.mul(14).add(shape.x.mul(TAU)).sin().mul(0.035))
      const fibreGap = centerFlat.add(axisFlat.mul(reachAlong)).add(curl).length()
      const isFibre = identity.x.step(0.5).oneMinus().mul(identity.y.step(0.6).oneMinus()).mul(identity.z.step(0.3).oneMinus()).mul(shape.z.step(0.45))
      const fibre = fibreGap.smoothstep(footprint.max(0.006).add(0.008), 0.004).mul(isFibre).mul(resolved).mul(present)
      light = light.mul(fibre.mul(-0.8).add(1))
      light = light.mul(mote.mul(-0.85).add(1).mul(spangle.mul(-0.5).add(1)).mul(bubble.mul(-0.3).add(1)))
      return spangleLight.add(bubbleLight).mul(reach).mul(present)
    }
    let inclusions: Node<'vec3'> = vec3(0)
    for (const stratum of [{
      depth: 0.012,
      scale: 62,
      seed: 1.3,
    }, {
      depth: 0.03,
      scale: 44,
      seed: 7.9,
    }, {
      depth: 0.055,
      scale: 34,
      seed: 13.1,
    }, {
      depth: 0.09,
      scale: 26,
      seed: 21.7,
    }, {
      depth: 0.14,
      scale: 20,
      seed: 33.3,
    }] satisfies Array<Stratum>) {
      inclusions = inclusions.add(strata(stratum).mul(veil))
      veil = veil.mul(0.97)
    }
    const crazing = mx_noise_float(entry.mul(140)).abs().smoothstep(0.02, 0).mul(near).mul(0.5)
    this.colorNode = color(hsl.integer(58, 100, 5.4))
    this.metalness = 0
    this.roughnessNode = crazing.mul(0.3).add(0.035)
    this.specularIntensity = 0.55
    this.ior = 1.54
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.02
    this.emissiveNode = light.add(inclusions).mul(facing.mul(0.25).add(0.75))
  }
}
