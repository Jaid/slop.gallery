import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A woven fabric of glass fiber optic threads. Warp and weft interlace in an over-under pattern. Pulses of colored light race along the threads, creating a living tapestry of data. The weave becomes visible up close; from afar it shimmers. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {grazing, intimate} = viewerFrame()
    const tube = uv()
    // Weave structure — warp (along tube length) and weft (around tube)
    const warpScale = 120
    const weftScale = 24
    const warpPhase = tube.x.mul(warpScale)
    const weftPhase = tube.y.mul(weftScale)
    // Which layer is on top? Alternating checkerboard
    const warpCell = warpPhase.floor()
    const weftCell = weftPhase.floor()
    const checker = warpCell.add(weftCell).mod(2)
    // Thread profiles — smooth cylindrical cross-section
    const warpFraction = warpPhase.fract().sub(0.5)
    const weftFraction = weftPhase.fract().sub(0.5)
    // Thread radius visualization
    const threadRadius = 0.35
    const warpThread = warpFraction.abs().smoothstep(threadRadius, threadRadius * 0.3)
    const weftThread = weftFraction.abs().smoothstep(threadRadius, threadRadius * 0.3)
    // The visible thread depends on which is on top
    const warpOnTop = checker.smoothstep(0.4, 0.6)
    const visibleWarp = warpThread.mul(warpOnTop)
    const visibleWeft = weftThread.mul(warpOnTop.oneMinus())
    // Anti-aliasing: fade out fine structure at distance
    const warpFw = warpPhase.fwidth().max(0.001)
    const weftFw = weftPhase.fwidth().max(0.001)
    const warpVisible = warpFw.smoothstep(0.4, 1.5).oneMinus()
    const weftVisible = weftFw.smoothstep(0.4, 1.5).oneMinus()
    const warpFinal = visibleWarp.mul(warpVisible)
    const weftFinal = visibleWeft.mul(weftVisible)
    const threadMask = warpFinal.add(weftFinal).clamp()
    // Gap between threads — dark at intersections
    const gap = warpThread.oneMinus().mul(weftThread.oneMinus())
      .mul(warpVisible.max(weftVisible))
    // Light pulses racing along threads
    // Warp pulses travel along tube.x
    const warpPulseSpeed = 3.5
    const warpPulseScale = 8
    const warpPulsePhase = tube.x.mul(warpPulseScale).sub(time.mul(warpPulseSpeed))
    const warpPulse = warpPulsePhase.sin().mul(0.5).add(0.5).pow(4)
    // Weft pulses travel along tube.y
    const weftPulseSpeed = 2.8
    const weftPulseScale = 14
    const weftPulsePhase = tube.y.mul(weftPulseScale).add(time.mul(weftPulseSpeed))
    const weftPulse = weftPulsePhase.sin().mul(0.5).add(0.5).pow(4)
    // Each thread gets a different pulse color
    const warpColorPhase = warpCell.mul(0.137).add(time.mul(0.02))
    const weftColorPhase = weftCell.mul(0.213).add(time.mul(0.015)).add(0.5)
    const warpColor = cosinePalette(
      warpColorPhase,
      [0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [1, 0.7, 0.4],
      [0, 0.15, 0.2],
    )
    const weftColor = cosinePalette(
      weftColorPhase,
      [0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.4, 0.7, 1],
      [0.3, 0.2, 0],
    )
    // Glass fiber base color — translucent white/pale blue
    const fiberBase = color(hsl.integer(248, 13, 83))
    const fiberDark = color(hsl.integer(248, 12, 31))
    // Thread color modulated by cylindrical profile (brighter at center)
    const warpProfile = warpFraction.abs().div(threadRadius).clamp().oneMinus().pow(0.5)
    const weftProfile = weftFraction.abs().div(threadRadius).clamp().oneMinus().pow(0.5)
    this.colorNode = mix(
      fiberDark,
      fiberBase,
      threadMask.mul(0.6).add(0.2),
    ).mul(gap.mul(-0.4).add(1))
    // Glass-like properties
    this.transmission = 0.5
    this.thickness = 0.3
    this.ior = 1.52
    this.attenuationColor.set(hsl.integer(248, 18, 71))
    this.attenuationDistance = 1.5
    this.metalness = 0
    this.roughnessNode = float(0.12)
      .add(gap.mul(0.3))
      .sub(threadMask.mul(0.06))
      .clamp(0.04, 0.45)
    // Anisotropic reflections along thread direction
    this.anisotropy = 0.5
    this.anisotropyNode = mix(
      vec2(0.5, 0),
      vec2(0, 0.5),
      warpOnTop,
    )
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.06
    // Normal — cylindrical thread profiles
    const threadNormal = warpFinal.mul(warpFraction.mul(3))
      .add(weftFinal.mul(weftFraction.mul(3)))
    this.normalNode = proceduralNormal(
      threadNormal.add(gap.mul(0.3)),
      0.0008,
    )
    // Emissive — the light pulses are the main spectacle
    const warpEmission = warpColor.mul(warpPulse).mul(warpFinal).mul(warpProfile)
    const weftEmission = weftColor.mul(weftPulse).mul(weftFinal).mul(weftProfile)
    // Intersection glow — where crossing pulses meet
    const crossGlow = warpPulse.mul(weftPulse).mul(threadMask).mul(intimate)
    // Data burst — occasional bright flash along entire thread
    const burstPhase = mx_noise_float(vec3(warpCell.mul(0.7), time.mul(0.8).floor(), float(7.3)))
    const burst = burstPhase.smoothstep(0.88, 0.92).mul(warpFinal)
    // Rim illumination
    const rimLight = grazing.pow(3).mul(threadMask)
    this.emissiveNode = warpEmission.mul(1.5)
      .add(weftEmission.mul(1.5))
      .add(color(hsl.integer(0, 0, 100)).mul(crossGlow).mul(2))
      .add(color(hsl.integer(195, 100, 91.6)).mul(burst).mul(1.2))
      .add(color(hsl.integer(275, 100, 74)).mul(rimLight).mul(0.15))
  }
}
