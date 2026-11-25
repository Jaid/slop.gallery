import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_noise_float, negateOnBackSide, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {resolved, ruled, wave} from '../../candidates/gpt_astra/lib/surface/coverage.ts'
import {exhibitionFrame} from '../../candidates/gpt_astra/lib/surface/frame.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** Small, continuous relief with a vertex-stage normal reconstructed from the same displaced surface. */
function tubeRelief(heightAt: (tube: Node<'vec2'>) => Node<'float'>) {
  const surface = Fn(([tube]: [Node<'vec2'>]) => {
    const frame = knotFrame(tube)
    return frame.position.add(frame.normal.mul(heightAt(tube)))
  })
  const tube = uv()
  const epsilon = 0.0001
  const du = surface(tube.add(vec2(epsilon, 0))).sub(surface(tube.sub(vec2(epsilon, 0))))
  const dv = surface(tube.add(vec2(0, epsilon))).sub(surface(tube.sub(vec2(0, epsilon))))
  return {
    position: surface(tube),
    normal: negateOnBackSide(varying(transformNormalToView(du.cross(dv).normalize())).normalize()),
  }
}
function dunes(tube: Node<'vec2'>) {
  const bend = tube.x.mul(TAU * 2).sin().mul(0.9)
  const phase = tube.y.mul(TAU * 5).add(tube.x.mul(TAU * 8)).add(bend)
  const wind = time.mul(0.11).sin().mul(0.12)
  return phase.add(wind).sin().mul(0.007).add(phase.mul(2).sub(0.7).sin().mul(0.002))
}
/** Dry mineral strata, rounded wind-carved relief and sparse, directional quartz grains. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.58)
    this.name = knotData.id
    const {p, view, intimate, near} = exhibitionFrame()
    const relief = tubeRelief(dunes)
    this.positionNode = relief.position
    const erosion = mx_noise_float(p.mul(3.8)).mul(2.6).add(mx_noise_float(p.mul(11)).mul(0.28))
    const strata = p.z.mul(21).add(p.x.mul(10)).add(p.y.mul(4)).add(erosion)
    const broad = wave(strata.mul(2.6))
    const thin = ruled(strata.mul(2.1), 0.085)
    const chalk = broad.smoothstep(0.48, 0.83)
    const iron = ruled(strata.mul(0.55).add(0.13), 0.045)
    const ocher = mix(color(hsl.integer(47, 60, 55)), color(hsl.integer(75, 63, 78)), broad)
    const stone = mix(ocher, color(hsl.integer(85, 61, 89.5)), chalk)
    const sediment = mix(mix(stone, color(hsl.integer(42, 58, 46)), thin.mul(0.5)), color(hsl.integer(30, 45, 33)), iron.mul(0.52))
    const grainDomain = p.mul(230)
    const grains = cellNoiseVec3(grainDomain)
    const grainVisibility = resolved(grainDomain)
    const grain = mx_noise_float(p.mul(285)).mul(intimate).mul(grainVisibility)
    this.colorNode = sediment.mul(grain.mul(0.07).add(0.97))
    this.metalness = 0.035
    this.roughnessNode = float(0.76).sub(chalk.mul(0.12)).sub(thin.mul(0.07))
    this.sheenNode = color(hsl.integer(70, 53, 81)).mul(0.12)
    this.sheenRoughness = 0.8
    const ripples = wave(strata.mul(28).add(uv().x.mul(TAU * 8))).mul(intimate)
    // Preserve the displaced normal, then add only the submillimeter surface gradient.
    const micro = proceduralNormal(grain.mul(0.00007).add(ripples.mul(0.00008)), 1)
    const base = proceduralNormal(float(0), 1)
    this.normalNode = relief.normal.add(micro.sub(base)).normalize()
    this.aoNode = broad.mul(0.07).add(0.91)
    const halfSum = view.add(vec3(-0.32, 0.78, 0.54).normalize())
    const halfVector = halfSum.div(halfSum.length().max(0.0001))
    const mineralVector = grains.mul(2).sub(1)
    const mineralNormal = mineralVector.div(mineralVector.length().max(0.0001))
    const glitter = mineralNormal.dot(halfVector).clamp().pow(95).mul(grains.z.smoothstep(0.86, 0.97))
      .mul(grainVisibility).mul(near)
    this.emissiveNode = color(hsl.integer(87, 100, 95.2)).mul(glitter).mul(0.3)
  }
}
