import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {
  color,
  float,
  mix,
  time,
  uv,
  vec2,
} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2) // Mirror reflections on polished silicon dioxide
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    // 1. Silicon Processor Floorplan: Integrated Circuit Dies and Gold Contact Pads
    const dieGrid = vec2(tube.x.mul(16), tube.y.mul(4))
    const dieLocal = dieGrid.fract().sub(0.5).abs()
    const dieEdge = dieLocal.x.max(dieLocal.y)
    // Die boundary isolation trench and perimeter gold contact pads
    const dieTrench = dieEdge.smoothstep(0.45, 0.49)
    const goldPads = dieEdge.sub(0.42).abs().smoothstep(0.04, 0.01)
    // 2. Optical Waveguides (Lithographic Light Guides)
    const waveguideTracks = tube.y.mul(32).fract().sub(0.5).abs().smoothstep(0.09, 0.02)
    const crossGuides = tube.x.mul(64).fract().sub(0.5).abs().smoothstep(0.08, 0.02)
    const busLines = waveguideTracks.max(crossGuides)
    // Coherent Laser Packets streaming through waveguides at relativistic speed
    const packetStreamA = tube.x.mul(90).sub(time.mul(6.5)).sin().smoothstep(0.82, 0.98)
    const packetStreamB = tube.x.mul(130).add(time.mul(8.2)).sin().smoothstep(0.85, 0.99)
    const packetStreamC = tube.y.mul(45).sub(time.mul(5)).sin().smoothstep(0.8, 0.97)
    // Laser wavelengths: coherent ruby (650 nm), emerald (532 nm), and sapphire (450 nm)
    const rubyLaser = color(hsl.integer(19, 100, 57.4))
    const emeraldLaser = color(hsl.integer(152.6, 100, 85.6))
    const sapphireLaser = color(hsl.integer(254, 100, 57.3))
    const laserSignals = rubyLaser.mul(packetStreamA)
      .add(emeraldLaser.mul(packetStreamB))
      .add(sapphireLaser.mul(packetStreamC))
      .mul(busLines)
    // 3. Qubit Mach-Zehnder Interferometer Rings
    const qubitGrid = vec2(tube.x.mul(32), tube.y.mul(8)).fract().sub(0.5)
    const qubitRadius = qubitGrid.length()
    const qubitRing = qubitRadius.sub(0.25).abs().smoothstep(0.035, 0.005)
    const qubitPhase = time.mul(2.5).add(tube.x.mul(10)).sin().mul(0.5).add(0.5)
    const qubitInterference = mix(rubyLaser, sapphireLaser, qubitPhase).mul(qubitRing)
    // 4. Silicon Wafer Diffraction Grating (Nanometer Lithography Rainbow Sheen)
    // Periodic nanometer tracks diffract ambient studio light into sharp spectral fans
    const gratingPhase = tube.x.mul(TAU * 160).add(tube.y.mul(TAU * 40)).add(facing.mul(TAU * 4))
    const waferRainbow = spectralColor(gratingPhase)
    const diffractionSheen = waferRainbow.mul(grazing.mul(0.7).add(0.3)).mul(dieTrench.oneMinus())
    // 5. Materials and Substrates
    // Polished silicon substrate (dark mirror-specular semiconductor)
    const siliconSubstrate = color(hsl.integer(270, 21, 11))
    const trenchColor = color(hsl.integer(264, 15, 6))
    const goldAlbedo = color(hsl.integer(89.7, 100, 86))
    const chipSurface = mix(
      mix(siliconSubstrate, trenchColor, dieTrench.mul(0.8)),
      goldAlbedo,
      goldPads,
    )
    // PBR Properties
    this.colorNode = mix(chipSurface, diffractionSheen, float(0.35))
    this.metalnessNode = mix(float(0.92), float(1), goldPads)
    this.roughnessNode = mix(
      float(0.08), // Flawless optical silicon
      float(0.38),
      dieTrench.max(goldPads.mul(0.3)),
    )
    // Highly directional anisotropy oriented along the chip bus architecture
    this.anisotropy = 0.88
    this.anisotropyNode = vec2(0.88, 0).mul(dieTrench.oneMinus())
    // Silicon dioxide (SiO2) optical passivation clearcoat
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.02
    this.ior = 1.46 // SiO2 glass
    // Microscopic quantum logic nodes (sub-micron optical gates)
    const logicNodes = cellularPoints(p.mul(90), 0.03, 0.16, 0.72)
    const logicSparkle = color(hsl.integer(0, 0, 100)).mul(logicNodes).mul(intimate)
    // Photonic emission: streaming laser packets, qubit rings, and circuit status
    this.emissiveNode = laserSignals
      .mul(near.mul(0.4).add(0.85))
      .mul(4.2)
      .add(qubitInterference.mul(3.6))
      .add(diffractionSheen.mul(0.35).mul(grazing.pow(2)))
      .add(logicSparkle.mul(2))
  }
}
