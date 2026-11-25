import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, uv, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Swirling gas giant atmospheric bands wrapped around the knot. Zonal jets create latitude-dependent flow with shear vortices spawning at band boundaries. Closer approach speeds up the visible flow and reveals finer turbulent detail. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {grazing, near, intimate} = viewerFrame()
    const tube = uv()
    // Use tube.y as "latitude" and tube.x as "longitude"
    const latitude = tube.y
    const longitude = tube.x
    // Zonal band structure — alternating jet streams
    const bandCount = 7
    const bandPhase = latitude.mul(bandCount * Math.PI * 2)
    const bandRaw = bandPhase.sin()
    const bandIndex = bandPhase.div(Math.PI * 2).floor()
    // Flow speed alternates direction per band and increases with proximity
    const flowSpeed = bandRaw.mul(0.15).add(
      mx_noise_float(vec3(0, bandIndex.mul(7.3), 13.7)).mul(0.08),
    )
    const flowTime = time.mul(near.mul(1.5).add(0.5))
    const flowOffset = longitude.add(flowSpeed.mul(flowTime))
    // Large-scale turbulence — domain-warped noise stretches along flow direction
    const stretchedP = vec3(
      flowOffset.mul(16),
      latitude.mul(8),
      float(0),
    )
    const warp = mx_noise_float(stretchedP.mul(0.5).add(vec3(flowTime.mul(0.02), 0, 0)))
    const turbulence = mx_fractal_noise_float(
      stretchedP.add(vec3(warp.mul(2), warp.mul(0.8), 0)),
      4,
      2,
      0.52,
    )
    // Storm vortices at band boundaries
    const bandBoundary = bandRaw.abs().smoothstep(0, 0.15)
    const vortexField = mx_noise_float(
      vec3(flowOffset.mul(12), latitude.mul(12), time.mul(0.04)),
    )
    const vortexStrength = bandBoundary.mul(vortexField.mul(0.5).add(0.5).pow(3))
    // Great Red Spot — a persistent anticyclone
    const spotCenter = vec3(0.35, 0.42, 0)
    const spotCoord = vec3(flowOffset.sub(spotCenter.x).add(time.mul(0.005)), latitude.sub(spotCenter.y), float(0))
    const spotDist = spotCoord.mul(vec3(1.8, 3.5, 0)).length()
    const spot = spotDist.smoothstep(0.2, 0.02)
    // Spiral arms inside the spot
    const spotAngle = mx_atan2(spotCoord.y, spotCoord.x.add(0.0001)) as unknown as Node<'float'>
    const spiral = spotAngle.add(spotDist.mul(12)).add(time.mul(0.3)).sin().mul(0.5).add(0.5)
    const spotDetail = spiral.mul(spot).mul(near)
    // Fine cloud detail — smaller eddies visible up close
    const fineP = vec3(flowOffset.mul(48), latitude.mul(24), float(0))
    const fineClouds = mx_fractal_noise_float(
      fineP.add(vec3(flowTime.mul(0.05), 0, 0)),
      2,
      2.1,
      0.5,
    ).mul(0.5).add(0.5)
    const fineDetail = fineClouds.mul(intimate)
    // Color palette — Jupiter's signature bands
    const ammoniaWhite = color(hsl.integer(92, 46, 92))
    const ammoniaOrange = color(hsl.integer(62, 67, 66))
    const sulfurBrown = color(hsl.integer(60, 59, 43))
    const deepOchre = color(hsl.integer(51, 70, 31))
    const stormRed = color(hsl.integer(33, 86, 48))
    const paleBand = color(hsl.integer(85, 44, 87))
    // Band coloring based on latitude
    const bandColorPhase = bandPhase.mul(0.5).cos().mul(0.5).add(0.5)
    const bandColor = mix(
      mix(ammoniaWhite, ammoniaOrange, bandColorPhase),
      mix(sulfurBrown, paleBand, bandColorPhase.mul(1.5).clamp()),
      latitude.mul(3).sin().abs().mul(0.5),
    )
    // Turbulence modulates color
    const turbulenceColor = mix(bandColor, deepOchre, turbulence.mul(0.3).add(0.1).clamp())
    // Vortex coloring
    const vortexColor = mix(turbulenceColor, ammoniaWhite, vortexStrength.mul(0.4))
    // Great Red Spot coloring
    const finalColor = mix(vortexColor, stormRed, spot.mul(0.7).add(spotDetail.mul(0.2)))
    this.colorNode = finalColor.add(color(hsl.integer(84, 53, 84)).mul(fineDetail).mul(0.08))
    this.metalness = 0
    this.roughnessNode = float(0.65)
      .sub(vortexStrength.mul(0.15))
      .sub(spot.mul(0.1))
      .add(fineDetail.mul(0.05))
      .clamp(0.4, 0.75)
    // Subtle subsurface-like quality — gas is translucent
    this.sheen = 0.4
    this.sheenColor.set(hsl.integer(84, 62, 82))
    this.sheenRoughness = 0.55
    // Cloud layer normals
    const cloudHeight = turbulence.mul(0.3)
      .add(vortexStrength.mul(0.2))
      .add(spot.mul(0.15))
      .add(fineDetail.mul(0.1))
    this.normalNode = proceduralNormal(cloudHeight, 0.0015)
    // Slight displacement for cloud depth
    const cloudDisp = cloudHeight.mul(0.008)
    this.positionNode = positionGeometry.add(normalLocal.mul(cloudDisp))
    // Emissive — lightning in storm systems and aurora at high latitudes
    // Lightning
    const lightningField = mx_noise_float(
      vec3(flowOffset.mul(30), latitude.mul(15), time.mul(8)),
    )
    const lightning = lightningField.smoothstep(0.92, 0.96)
      .mul(vortexStrength.add(spot))
      .mul(near)
    // Deep thermal glow through thin cloud regions
    const thinCloud = turbulence.smoothstep(-0.2, 0.1).oneMinus()
    const thermalGlow = thinCloud.mul(intimate).mul(0.08)
    // Rim glow — atmospheric limb brightening
    const limbGlow = grazing.pow(3).mul(0.12)
    this.emissiveNode = color(hsl.integer(297, 100, 91)).mul(lightning).mul(3)
      .add(color(hsl.integer(39, 100, 65)).mul(thermalGlow))
      .add(color(hsl.integer(76, 100, 88.6)).mul(limbGlow))
      .add(color(hsl.integer(32, 100, 60.2)).mul(spot).mul(spotDetail).mul(intimate).mul(0.12))
  }
}
