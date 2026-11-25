import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {fill, roundedBox, stroke} from '../../candidates/gpt_sol/lib/exhibition/coverage.ts'
import {filteredCos, resolved} from '../../candidates/gpt_sol/lib/exhibition/fields.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import data from './data.ts'

/** Lenticular landscape miniatures. Local viewing angle crossfades sunset and moonlight; four planes provide bounded parallax. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = data.id
    const tube = uv()
    const {near, intimate, grazing} = viewerFrame()
    const count = vec2(10, 2)
    const q = tube.mul(count)
    const local = q.fract().sub(0.5)
    const random = cellNoiseVec3(vec3(wrapCell(q.floor(), count), 132.4))
    const ray = tubeRay().mul(count)
    const foot = q.fwidth().length().max(0.00001)
    const apertureDistance = roundedBox(local, 0.445, 0.41, 0.065)
    const aperture = fill(apertureDistance, foot).toVar()
    const bezel = stroke(apertureDistance.sub(0.014), 0.014, foot).toVar()
    const night = positionViewDirection.dot(tangentView.normalize()).add(random.x.mul(0.22).sub(0.11)).smoothstep(-0.3, 0.3).toVar()
    const skyPoint = local.sub(ray.mul(0.085)).toVar()
    const skyHeight = skyPoint.y.mul(1.2).add(0.45).clamp()
    const daySky = mix(color(hsl.integer(78, 100, 89.4)), color(hsl.integer(345, 54, 47)), skyHeight)
    const nightSky = mix(color(hsl.integer(224, 72, 43)), color(hsl.integer(266, 75, 12.5)), skyHeight)
    const sky = mix(daySky, nightSky, night)
    const cloudPhase = skyPoint.x.mul(10).add(skyPoint.y.mul(21)).sub(time.mul(0.045)).add(random.z.mul(5))
    const clouds = filteredCos(cloudPhase).mul(0.5).add(0.5).pow(5).mul(skyPoint.y.smoothstep(-0.02, 0.15)).mul(0.13)
    const sunPoint = skyPoint.sub(vec2(random.x.mul(0.27).add(0.03), random.y.mul(0.13).add(0.17)))
    const sun = fill(sunPoint.length().sub(0.078), foot)
    const moonBite = fill(sunPoint.sub(vec2(0.038, 0.019)).length().sub(0.073), foot)
    const celestial = mix(sun, sun.mul(moonBite.oneMinus()), night).toVar()
    const glow = sunPoint.length().mul(-10).exp().mul(0.12)
    let landscape = sky.add(mix(color(hsl.integer(85, 100, 92)), color(hsl.integer(259, 100, 88)), night).mul(celestial.mul(0.65).add(glow))).add(color(hsl.integer(342, 43, 81)).mul(clouds))
    const farPoint = local.sub(ray.mul(0.06))
    const farHeight = farPoint.x.mul(7).add(random.z.mul(5)).sin().mul(0.075).add(farPoint.x.mul(16).sin().mul(0.023)).add(0.025)
    const far = fill(farPoint.y.sub(farHeight), foot).toVar()
    landscape = mix(landscape, mix(color(hsl.integer(328, 43, 44.5)), color(hsl.integer(251, 57, 29)), night), far)
    const midPoint = local.sub(ray.mul(0.035))
    const midHeight = midPoint.x.mul(8).sub(random.y.mul(5)).sin().mul(0.07).add(midPoint.x.mul(19).cos().mul(0.024)).sub(0.085)
    const middle = fill(midPoint.y.sub(midHeight), foot).toVar()
    landscape = mix(landscape, mix(color(hsl.integer(311, 47, 32)), color(hsl.integer(241, 65, 25)), night), middle)
    const waterPoint = local.sub(ray.mul(0.018))
    const lake = fill(waterPoint.y.add(0.16), foot).toVar()
    const waterPhase = waterPoint.y.mul(115).add(waterPoint.x.mul(19).sin().mul(1.3)).sub(time.mul(0.75))
    const ripple = filteredCos(waterPhase).mul(0.5).add(0.5).pow(3).toVar()
    const reflectionPath = waterPoint.x.sub(random.x.mul(0.27).add(0.03)).mul(7).pow2().negate().exp()
    const water = mix(color(hsl.integer(2, 48, 56)), color(hsl.integer(221, 71, 39)), night).mul(ripple.mul(0.2).add(0.8)).add(mix(color(hsl.integer(78, 100, 87)), color(hsl.integer(209, 55, 89)), night).mul(ripple).mul(reflectionPath).mul(0.25))
    landscape = mix(landscape, water, lake)
    const starQ = skyPoint.mul(vec2(17, 12))
    const starId = cellNoiseVec3(vec3(starQ.floor(), random.z.mul(30)))
    const starLocal = starQ.fract().sub(starId.xy.mul(0.5).add(0.25))
    const starFoot = foot.mul(20).max(0.0001)
    const starOuter = starFoot.add(0.035).min(0.24)
    const starInner = float(0.035).sub(starFoot).max(0)
    const stars = starLocal.length().smoothstep(starInner, starOuter).oneMinus().mul(float(0.035).div(starOuter).pow2()).mul(starId.z.smoothstep(0.87, 0.97)).mul(resolved(starFoot, 0.15, 0.85)).mul(far.oneMinus()).mul(night).toVar()
    landscape = landscape.add(color(hsl.integer(238, 100, 92)).mul(stars).mul(0.6))
    const birdsPoint = skyPoint.sub(vec2(-0.19, 0.19))
    const birdShape = birdsPoint.y.sub(birdsPoint.x.abs().mul(time.mul(1.1).sin().mul(0.35).add(0.2)))
    const birds = stroke(birdShape, 0.004, foot).mul(fill(birdsPoint.x.abs().sub(0.047), foot)).mul(night.oneMinus()).toVar()
    landscape = mix(landscape, color(hsl.integer(310, 45, 21)), birds.mul(0.8))
    const optic = filteredCos(tube.x.mul(TAU * 2400)).mul(intimate).toVar()
    const shell = mix(color(hsl.integer(213, 12, 81)), color(hsl.integer(87, 100, 96.4)), grazing.mul(0.4).add(0.3))
    this.colorNode = mix(shell, landscape, aperture).mul(bezel.mul(-0.11).add(1)).add(color(hsl.integer(84, 56, 76)).mul(bezel).mul(0.2))
    this.metalnessNode = bezel.mul(0.55).add(aperture.oneMinus().mul(0.08))
    this.roughnessNode = mix(float(0.3), float(0.105).add(optic.mul(0.015)), aperture)
    this.normalNode = proceduralNormal(bezel.mul(0.0012).add(optic.mul(aperture).mul(0.000035)), 0.7)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.18), float(0.06), aperture)
    this.ior = 1.49
    this.emissiveNode = landscape.mul(aperture).mul(night.mul(0.23).add(0.12)).add(color(hsl.integer(81, 100, 92)).mul(celestial).mul(aperture).mul(near).mul(0.13))
  }
}
