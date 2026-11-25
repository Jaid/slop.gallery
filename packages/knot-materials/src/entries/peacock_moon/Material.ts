import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const featherField = (tube: Node<'vec2'>) => {
  const q = tube.mul(vec2(18, 3))
  const cell = q.floor()
  const random = cellNoiseVec3(vec3(cell.x, cell.y, 19.4))
  const local = q.fract().sub(0.5)
  const angle = random.x.sub(0.5).mul(0.48)
  const rotated = vec2(local.x.mul(angle.cos()).sub(local.y.mul(angle.sin())), local.x.mul(angle.sin()).add(local.y.mul(angle.cos())))
  const radius = rotated.div(vec2(0.47, 0.34)).length()
  const scale = float(1).sub(radius.smoothstep(0.78, 1.06))
  const shaft = float(1).sub(rotated.y.abs().smoothstep(0.014, 0.045)).mul(scale)
  const barbPhase = rotated.x.mul(28).add(rotated.y.mul(4.2)).add(random.y.mul(2.2))
  const barb = float(1).sub(barbPhase.sin().abs().smoothstep(0.13, 0.52)).mul(scale)
  const eyeGate = random.z.smoothstep(0.72, 0.9)
  const eyeRadius = rotated.length()
  const eye = float(1).sub(eyeRadius.smoothstep(0.31, 0.38)).mul(eyeGate).mul(scale)
  const eyeRing = float(1).sub(eyeRadius.sub(0.235).abs().smoothstep(0.012, 0.045)).mul(eyeGate)
  const pupil = float(1).sub(eyeRadius.smoothstep(0.065, 0.11)).mul(eyeGate)
  const barbFootprint = barbPhase.fwidth().max(0.02)
  const resolvedBarbs = barb.mul(barbFootprint.smoothstep(0.7, 2.2).oneMinus())
  return {
    random,
    rotated,
    scale,
    shaft,
    barb: resolvedBarbs,
    eye,
    eyeRing,
    pupil,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.18)
    this.name = knotData.id
    this.envMapIntensity = 1.18
    const tube = uv()
    const feather = featherField(tube)
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const drift = time.mul(0.075).add(feather.random.x.mul(TAU))
    const structuralPhase = feather.rotated.x.mul(5.2).add(feather.rotated.y.mul(3.1)).add(view.dot(vec3(0.4, 0.75, -0.52)).mul(2.5)).add(drift)
    const spectral = spectralColor(structuralPhase.mul(0.13).add(feather.random.y))
    const blueGreen = mix(color(hsl.integer(222, 80, 17)), color(hsl.integer(207, 93, 41)), spectral.x.mul(0.48).add(0.16))
    const blue = mix(color(hsl.integer(262, 72, 17)), color(hsl.integer(265, 79, 35)), spectral.z.mul(0.42).add(0.12))
    const body = mix(blueGreen, blue, spectral.y.mul(0.5).add(0.18)).mul(feather.scale.mul(0.18).add(0.78))
    const ocellus = mix(color(hsl.integer(67, 86, 65)), color(hsl.integer(192, 83, 71)), feather.random.y).mul(feather.eyeRing.mul(0.8).add(0.2))
    const eyeColor = mix(ocellus, color(hsl.integer(276, 47, 6)), feather.pupil)
    const shaftColor = mix(color(hsl.integer(81, 65, 77)), color(hsl.integer(181, 69, 82)), feather.random.x)
    this.colorNode = mix(body, eyeColor, feather.eye).mul(feather.scale.mul(0.08).add(0.92))
    this.metalnessNode = float(0.34).add(feather.eye.mul(0.28)).add(feather.scale.mul(-0.12)).sub(feather.shaft.mul(0.18))
    this.roughnessNode = float(0.25).sub(feather.eye.mul(0.1)).sub(feather.barb.mul(0.07)).add(grazing.mul(0.04)).clamp(0.08, 0.46)
    this.iridescence = 1
    this.iridescenceIOR = 1.29
    this.iridescenceThicknessNode = structuralPhase.mul(26).add(feather.eye.mul(110)).add(facing.mul(120)).add(240)
    this.sheen = 0.42
    this.sheenColor.set(hsl.integer(185, 73, 90.3))
    this.sheenRoughness = 0.18
    this.clearcoat = 0.8
    this.clearcoatRoughnessNode = float(0.075).add(feather.barb.mul(0.08))
    const relief = feather.scale.mul(0.0018).add(feather.eye.mul(0.0055)).sub(feather.pupil.mul(0.001))
    this.positionNode = positionGeometry.add(normalLocal.mul(relief))
    const surfaceNormal = proceduralNormal(feather.barb.mul(0.00065).add(feather.shaft.mul(0.0012)).add(feather.eyeRing.mul(0.0007)).add(relief.mul(0.6)), 0.8)
    this.normalNode = surfaceNormal
    this.clearcoatNormalNode = surfaceNormal
    this.aoNode = float(1).sub(feather.eye.mul(0.1)).sub(feather.pupil.mul(0.12))
    const shimmer = structuralPhase.sin().mul(0.5).add(0.5).pow(7)
    this.emissiveNode = shaftColor.mul(feather.shaft.mul(0.22)).mul(near.mul(0.5).add(0.2))
      .add(color(hsl.integer(186, 100, 90.5)).mul(feather.eyeRing).mul(shimmer).mul(near.mul(0.34).add(0.12)))
      .add(color(hsl.integer(96, 100, 94.4)).mul(feather.pupil).mul(0.03))
      .add(color(hsl.integer(269, 100, 67)).mul(glints(surfaceNormal, 110)).mul(feather.barb).mul(intimate.mul(0.08)))
  }
}
