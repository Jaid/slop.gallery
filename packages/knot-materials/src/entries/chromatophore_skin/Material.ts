import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, modelWorldMatrixInverse, mx_noise_float, normalLocal, positionGeometry, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../candidates/gpt_sol/lib/filament.ts'
import {viewerFrame} from '../../candidates/gpt_sol/lib/viewerFrame.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.85
    const p = positionGeometry
    const cameraLocal = modelWorldMatrixInverse
      .mul(vec4(cameraPosition, 1))
      .xyz
    const proximity = cameraLocal
      .sub(p)
      .length()
      .smoothstep(1, 4.8)
      .oneMinus()
    const q = p.mul(17)
    const rnd = cellNoiseVec3(q)
    const centre = rnd.mul(0.52).add(0.24)
    const cellDistance = q.fract().sub(centre).length()
    const wavePhase = p
      .dot(vec3(0.64, 0.71, -0.29))
      .mul(13)
      .sub(time.mul(0.85))
      .add(rnd.z.mul(TAU))
    const wave = wavePhase
      .sin()
      .mul(0.5)
      .add(0.5)
    const activation = wave
      .pow(3)
      .mul(proximity.mul(0.75).add(0.25))
    const radius = activation
      .mul(0.11)
      .add(0.085)
    const discRaw = cellDistance
      .smoothstep(radius, radius.add(0.035))
      .oneMinus()
    const q2 = p.mul(39).add(13.7)
    const rnd2 = cellNoiseVec3(q2)
    const centre2 = rnd2.mul(0.5).add(0.25)
    const fineDistance = q2
      .fract()
      .sub(centre2)
      .length()
    const finePhase = p
      .dot(vec3(-0.46, 0.28, 0.84))
      .mul(21)
      .add(time.mul(0.33))
      .add(rnd2.y.mul(TAU))
    const fineSignal = finePhase
      .sin()
      .mul(0.5)
      .add(0.5)
    const fineRadius = fineSignal
      .mul(0.025)
      .add(proximity.mul(0.025))
      .add(0.055)
    const fineRaw = fineDistance
      .smoothstep(fineRadius, fineRadius.add(0.025))
      .oneMinus()
    const papillaHeight = discRaw
      .mul(activation)
      .mul(0.012)
      .add(fineRaw
        .mul(proximity)
        .mul(0.002))
    this.positionNode = p.add(normalLocal.mul(papillaHeight))
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const cellAA = cellDistance.fwidth().max(0.001)
    const disc = cellDistance
      .smoothstep(radius, radius
        .add(cellAA.mul(1.35))
        .add(0.004)
        .min(0.235))
      .oneMinus()
      .mul(cellAA
        .smoothstep(0.1, 0.36)
        .oneMinus())
    const fineAA = fineDistance.fwidth().max(0.001)
    const fineDisc = fineDistance
      .smoothstep(fineRadius, fineRadius
        .add(fineAA.mul(1.3))
        .add(0.003)
        .min(0.245))
      .oneMinus()
      .mul(fineAA
        .smoothstep(0.16, 0.55)
        .oneMinus())
      .mul(intimate)
    const structuralNoise = mx_noise_float(p.mul(24))
      .mul(0.5)
      .add(0.5)
    const structural = grazing
      .pow(1.35)
      .mul(structuralNoise
        .mul(0.5)
        .add(0.25))
      .clamp()
    const baseSkin = mix(color(hsl.integer(92, 18, 10)), color(hsl.integer(88, 24, 56)), facing.mul(0.35)
      .add(structuralNoise.mul(0.18))
      .clamp())
    const warmCell = mix(color(hsl.integer(66, 94, 66)), color(hsl.integer(31, 77, 27)), rnd.x)
    const cellColor = mix(warmCell, color(hsl.integer(242, 16, 9)), rnd.y.pow(1.7).mul(0.38))
    const body = mix(baseSkin, cellColor, disc)
    const detailedBody = mix(body, mix(color(hsl.integer(91, 48, 87)), color(hsl.integer(183, 26, 29)), rnd2.z), fineDisc.mul(0.62))
    const angleColor = view
      .dot(vec3(0.72, -0.16, 0.67).normalize())
      .mul(0.5)
      .add(0.5)
    const shimmerTint = mix(color(hsl.integer(181, 95, 61)), color(hsl.integer(275, 75, 48)), angleColor)
    this.colorNode = mix(detailedBody, shimmerTint, structural.mul(0.58))
    this.metalness = 0
    this.roughnessNode = float(0.42)
      .sub(disc.mul(0.16))
      .add(fineDisc.mul(0.08))
      .sub(structural.mul(0.08))
      .clamp(0.16, 0.55)
    this.clearcoat = 0.75
    this.clearcoatRoughness = 0.11
    this.sheen = 0.2
    this.sheenColor.set(hsl.integer(86, 38, 80))
    this.sheenRoughness = 0.5
    this.iridescence = 1
    this.iridescenceNode = structural
      .mul(0.9)
      .add(fineDisc.mul(0.12))
      .clamp()
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = structuralNoise
      .mul(260)
      .add(110)
    const skinNormal = proceduralNormal(papillaHeight
      .add(fineRaw.mul(0.0015))
      .add(structuralNoise.mul(0.0008)), 0.9)
    this.normalNode = skinNormal
    this.clearcoatNormalNode = skinNormal
    const waveFront = filament(wavePhase.sin(), 0.045)
    this.emissiveNode = color(hsl.integer(172, 100, 87.9))
      .mul(waveFront)
      .mul(disc)
      .mul(near)
      .mul(0.5)
      .add(color(hsl.integer(73, 100, 79))
        .mul(disc)
        .mul(activation)
        .mul(intimate)
        .mul(0.09))
  }
}
