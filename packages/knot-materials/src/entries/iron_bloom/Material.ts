import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, mx_worley_noise_vec3, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {ramp} from '../../candidates/deepseek/lib/ramp.ts'
import {tubeMetric} from '../../candidates/deepseek/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {displacementView} from '../../lib/displacementView.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/**
 * A living Rosensweig surface. A warped cellular field grows liquid-metal spikes;
 * each cell has its own height, the field breathes in slow waves, and the surface
 * lifts toward the visitor like iron filings greeting a magnet.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.45)
    this.name = knotData.id
    const metric = tubeMetric(uv())
    const {near, facing, grazing} = viewerFrame()
    const camera = displacementView()
    const strength = camera.near.mul(0.72).add(0.28)
    const heightAt = (tube: Node<'vec2'>, force: Node<'float'>) => {
      const m = tubeMetric(tube)
      const warp = mx_noise_vec3(vec3(m.mul(2.2), time.mul(0.045)))
      const pulseNoise = mx_noise_float(vec3(m.mul(1.55), 2.7))
      const pulse = m.x.mul(1.05).sub(time.mul(0.58)).add(pulseNoise.mul(2.1)).sin().mul(0.5).add(0.5)
      const primaryQ = vec3(m.mul(15).add(warp.xy.mul(2.6)), 0.7)
      const primaryCells = mx_worley_noise_vec3(primaryQ, 1, 0)
      const primaryRandom = cellNoiseVec3(primaryQ.floor())
      const primary = ramp(primaryCells.x, 0.38, 0.01).pow(0.6)
      const secondaryQ = vec3(m.mul(37).add(warp.xy.mul(1.2)), 11.3)
      const secondaryCells = mx_worley_noise_vec3(secondaryQ, 1, 0)
      const secondary = ramp(secondaryCells.x, 0.3, 0.006).pow(0.8)
      const primaryHeight = primary.mul(primaryRandom.x.mul(0.55).add(0.62))
      const secondaryHeight = secondary.mul(primaryRandom.y.mul(0.5).add(0.4))
      const wave = m.y.div(0.13).mul(3.1).add(m.x.mul(0.7)).add(time.mul(0.25)).sin().mul(0.5).add(0.5)
      const height = primaryHeight.mul(0.05).add(secondaryHeight.mul(0.013)).mul(force).mul(pulse.mul(0.55).add(0.58)).add(wave.mul(0.0014)).sub(0.006)
      return {
        height,
        primary,
        secondary,
        primaryRandom,
        pulse,
        wave,
      }
    }
    const displaced = (tube: Node<'vec2'>, force: Node<'float'>) => {
      const frame = knotFrame(tube)
      const {height} = heightAt(tube, force)
      return frame.position.add(frame.normal.mul(height))
    }
    const vertexField = heightAt(uv(), strength)
    const eps = 0.0001
    const du = displaced(uv().add(vec2(eps, 0)), strength).sub(displaced(uv().sub(vec2(eps, 0)), strength))
    const dv = displaced(uv().add(vec2(0, eps)), strength).sub(displaced(uv().sub(vec2(0, eps)), strength))
    const geometryNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displaced(uv(), strength).add(knotFrame(uv()).normal.mul(camera.facing.pow(4).mul(0.0035)))
    const tint = mix(color(hsl.integer(272, 50, 3)), color(hsl.integer(269, 53, 8)), vertexField.primary.mul(0.7).add(vertexField.secondary.mul(0.3)))
    this.colorNode = tint
    this.metalness = 1
    this.roughnessNode = mix(float(0.115), float(0.028), vertexField.primary.mul(0.75).add(vertexField.secondary.mul(0.25))).add(mx_noise_float(vec3(metric.mul(110), time.mul(0.1))).mul(0.008))
    this.iridescence = 0.58
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = vertexField.primary.mul(240).add(vertexField.secondary.mul(90)).add(facing.mul(160)).add(280)
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.018
    const micro = mx_noise_float(vec3(metric.mul(88), time.mul(0.14))).mul(0.00038)
    this.normalNode = detailNormal(geometryNormal, micro.add(vertexField.primary.mul(0.00025)), 0.9)
    const filamentPhase = metric.x.mul(0.92).add(metric.y.mul(11)).add(facing.mul(1.7)).add(time.mul(0.055))
    const trough = vertexField.primary.oneMinus().mul(vertexField.secondary.oneMinus())
    const tip = vertexField.primary.mul(strength)
    const rimGlow = spectralColor(filamentPhase).mul(grazing.pow(2.6)).mul(0.18)
    const troughGlow = spectralColor(filamentPhase.add(0.35)).mul(vec3(0.72, 0.52, 1.3)).mul(trough).mul(near.mul(0.5).add(0.25)).mul(0.055)
    const sparkle = glints(geometryNormal, 620).mul(tip.pow(2)).mul(near.mul(0.55).add(0.2)).mul(0.28)
    const keySheen = geometryNormal.dot(vec3(-0.38, 0.82, 0.42).normalize()).clamp().pow(5.5)
    const liquidSheen = color(hsl.integer(246, 100, 90.7)).mul(keySheen).mul(0.24)
    this.emissiveNode = troughGlow.add(rimGlow).add(color(hsl.integer(224, 100, 95)).mul(sparkle)).add(liquidSheen)
    this.aoNode = vertexField.primary.mul(0.3).add(0.7)
    this.envMapIntensity = 1.45
  }
}
