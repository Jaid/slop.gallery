import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
// Micro-scale processor die layout along the knot tube
    const u = tube.x.mul(32)
    const v = tube.y.mul(8)
    const dieGrid = vec2(u.floor(), v.floor())
    const dieUv = vec2(u.fract(), v.fract())
// Die boundary margins and scribe lines
    const borderDist = dieUv.sub(0.5).abs()
    const isScribe = borderDist.x.max(borderDist.y).smoothstep(0.47, 0.49)
// Multi-tier orthogonal waveguide bus grid
    const fineGrid = dieUv.mul(16)
    const fineGridId = fineGrid.floor()
    const fineUv = fineGrid.fract().sub(0.5)
    const traceH = fineUv.y.abs().smoothstep(0.12, 0.04)
    const traceV = fineUv.x.abs().smoothstep(0.12, 0.04)
    const isWaveguide = traceH.max(traceV).mul(float(1).sub(isScribe))
// Coherent laser packets propagating along the optical waveguides
    const packetH = fineGrid.x.sub(time.mul(7)).fract()
    const pulseH = packetH.smoothstep(0.72, 0.95).mul(traceH)
    const packetV = fineGrid.y.sub(time.mul(9)).fract()
    const pulseV = packetV.smoothstep(0.72, 0.95).mul(traceV)
    const laserData = pulseH.add(pulseV).clamp().mul(float(1).sub(isScribe))
// Quantum dot register array (qubit matrices)
    const qubitCoord = dieUv.mul(32)
    const qubitCell = qubitCoord.floor()
    const qubitUv = qubitCoord.fract().sub(0.5)
    const isQubitDot = qubitUv.length().smoothstep(0.24, 0.16)
    const clockTick = time.mul(6).floor()
    const qubitSeed = vec3(qubitCell.x, qubitCell.y, clockTick.add(dieGrid.x.mul(7)))
    const qubitNoise = mx_cell_noise_float(qubitSeed)
    const qubitActive = qubitNoise.smoothstep(0.45, 0.72).mul(isQubitDot).mul(float(1).sub(isScribe))
// Thin-film semiconductor wafer iridescence (oxide interference on mirror silicon)
    const iridPhase = grazing.mul(3.6).add(p.dot(vec3(2.5, 4.2, -1.8)).mul(0.6))
    const waferIrid = cosinePalette(iridPhase, [0.45, 0.5, 0.55], [0.4, 0.38, 0.45], [1.1, 1.1, 1.1], [0.05, 0.33, 0.67])
// Silicon wafer substrate color vs gold electrical traces vs dark etched isolation channels
    const siliconMirror = mix(color(hsl.integer(264, 24, 12)), color(hsl.integer(259, 28, 22)), mx_cell_noise_float(vec3(dieGrid, 1.2)).mul(0.3))
    const goldTrace = color(hsl.integer(87, 83, 77))
    const channelEtch = color(hsl.integer(269, 22, 6))
    let compColor = siliconMirror.add(waferIrid.mul(0.35))
    compColor = mix(compColor, channelEtch, isScribe)
    compColor = mix(compColor, goldTrace, isWaveguide.mul(0.65))
    this.colorNode = compColor
// Physical properties
    this.metalnessNode = float(1).sub(isScribe.mul(0.4)).mul(0.92)
    this.roughnessNode = mix(float(0.08), float(0.35), isScribe).add(isWaveguide.mul(0.04))
// Sapphire passivation clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.iridescence = 0.65
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = grazing.mul(350).add(180)
// Micro-etched trench normal relief
    const height = isWaveguide.mul(0.0016).sub(isScribe.mul(0.003)).add(isQubitDot.mul(0.002))
    this.normalNode = proceduralNormal(height, 0.88)
// Radiant laser emissions from waveguides and quantum qubits
    const laserCyan = color(hsl.integer(202, 100, 85))
    const laserMagenta = color(hsl.integer(357, 100, 60.1))
    const parity = fineGridId.x.add(fineGridId.y).mod(2)
    const laserTint = mix(laserCyan, laserMagenta, parity)
    const qubitGold = color(hsl.integer(92, 100, 86.4))
    this.emissiveNode = laserTint.mul(laserData).mul(2.8)
      .add(laserTint.mul(isWaveguide).mul(0.25))
      .add(qubitGold.mul(qubitActive).mul(near.mul(1.5).add(0.8)).mul(2.4))
      .add(color(hsl.integer(0, 0, 100)).mul(laserData.pow(3)).mul(1.5))
      .add(laserCyan.mul(isQubitDot).mul(intimate).mul(0.4))
      .add(laserMagenta.mul(rim).mul(grazing.pow(3)).mul(0.2))
  }
}
