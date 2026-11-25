import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_atan2, mx_noise_float, mx_noise_vec3, mx_worley_noise_vec3, negateOnBackSide, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Subtle convective bubbling of the solar envelope. Keeps the stellar limb smooth while simulating boiling acoustic waves. */
const solarEnvelopeDisplacement = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const t = time.mul(0.12)
  const acousticWaves = mx_noise_float(p.mul(14).add(vec3(t, t.mul(0.4), t.mul(-0.6))))
    .mul(0.008)
  return p.add(normal.mul(acousticWaves))
})
/** Analytical Planckian blackbody radiation calibrated for ACES filmic tonemapping. Preserves chromatic solar hues (deep umbra, fiery orange lanes, rich gold granules). */
function solarBlackbody(temperatureK: Node<'float'>) {
  const t = temperatureK.sub(3000).div(5000).clamp()
  const coolUmbra = vec3(0.08, 0.01, 0.003) // 3000 K deep dark umbra
  const warmPenumbra = vec3(0.55, 0.12, 0.01) // 4500 K penumbra
  const intergranular = vec3(0.9, 0.32, 0.02) // 5200 K fiery orange lane
  const granuleCore = vec3(1, 0.64, 0.08) // 6200 K rich solar gold
  const faculaHot = vec3(1.1, 0.96, 0.72) // 7800 K radiant white-gold
  return mix(
    coolUmbra,
    mix(
      warmPenumbra,
      mix(
        intergranular,
        mix(granuleCore, faculaHot, t.smoothstep(0.64, 1)),
        t.smoothstep(0.44, 0.64),
      ),
      t.smoothstep(0.25, 0.44),
    ),
    t.smoothstep(0, 0.25),
  )
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0) // An incandescent star emits its own light; zero external reflection
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    // Convective acoustic displacement of the stellar photosphere
    this.positionNode = solarEnvelopeDisplacement(tube)
    const eps = 0.0003
    const du = solarEnvelopeDisplacement(tube.add(vec2(eps, 0))).sub(solarEnvelopeDisplacement(tube.sub(vec2(eps, 0))))
    const dv = solarEnvelopeDisplacement(tube.add(vec2(0, eps))).sub(solarEnvelopeDisplacement(tube.sub(vec2(0, eps))))
    const displacedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.normalNode = negateOnBackSide(displacedNormal)
    // Solar rotation and boiling timescales
    const tBoil = time.mul(0.04)
    const tLoop = time.mul(0.2)
    // 1. Rayleigh-Bénard Convection: 5-to-6 sided polygonal Voronoi granulation
    const pWarped = p.add(mx_noise_vec3(p.mul(6).add(vec3(tBoil, 0, tBoil.mul(0.3)))).mul(0.02))
    const worley = mx_worley_noise_vec3(pWarped.mul(32), 1, 0)
    // Edge distance F2 - F1 gives tight, sharp intergranular lanes
    const laneDist = worley.y.sub(worley.x)
    const laneMask = laneDist.smoothstep(0.015, 0.12).oneMinus()
    // Soft dome falloff inside granules: brightest at cell centroid, falling off to border
    const domeIntensity = worley.x.smoothstep(0.42, 0.05)
    const subGranularTurbulence = mx_noise_float(p.mul(80).add(time.mul(0.12))).mul(0.08)
    // Base quiet-sun temperature: 5200 K in lanes, 6200 K in granule centers
    const quietTemperature = float(5200)
      .add(domeIntensity.mul(1000))
      .sub(laneMask.mul(300))
      .add(subGranularTurbulence.mul(500))
    // 2. Discrete Bipolar Sunspot Group
    const spotCenter = vec2(0.42, 0.48)
    const spotDelta = tube.sub(spotCenter)
    const rSpot = spotDelta.length().mul(5.5)
    const thetaSpot = mx_atan2(spotDelta.y, spotDelta.x) as unknown as import('three/webgpu').Node<'float'>
    // Radial penumbral magnetic filaments
    const radialFilaments = thetaSpot.mul(32).sin().mul(0.5).add(0.5)
      .mul(mx_noise_float(p.mul(35)).mul(0.4).add(0.6))
    // Cold dark umbra (3400 K) where convection is frozen by strong magnetic field
    const umbra = rSpot.smoothstep(0.16, 0.05)
    // Filamentary penumbra (4800 K)
    const penumbra = rSpot.smoothstep(0.46, 0.18).mul(umbra.oneMinus())
    // Bright magnetic faculae / plage network (7200 K) surrounding active spot
    const faculae = rSpot.sub(0.5).abs().smoothstep(0.12, 0.01).mul(1.1)
    // 3. Chromospheric H-alpha (656.3 nm) & SDO AIA 304 Å Prominence Loops
    const loopPhaseA = tube.x.mul(TAU * 4).add(tube.y.mul(TAU * 2)).add(tLoop).sin()
    const loopPhaseB = tube.x.mul(TAU * 3).sub(tube.y.mul(TAU * 3)).sub(tLoop.mul(0.8)).sin()
    const prominenceFibers = tube.x.mul(160).add(tLoop.mul(3)).sin().mul(0.5).add(0.5)
    const loopArc = loopPhaseA.smoothstep(0.72, 0.98).max(loopPhaseB.smoothstep(0.76, 0.98))
    const prominenceGlow = loopArc.mul(prominenceFibers.mul(0.4).add(0.6)).mul(umbra.oneMinus())
    // 4. Combined Surface Temperature (Kelvin)
    const surfaceTemperature = mix(
      quietTemperature,
      mix(float(4800).add(radialFilaments.mul(400)), float(3400), umbra),
      penumbra.add(umbra),
    ).add(faculae.mul(1200))
    // Accurate Planckian blackbody radiance
    const blackbodyRadiance = solarBlackbody(surfaceTemperature)
    // Chromospheric H-alpha prominence emission: vivid deep red-magenta (656.3 nm) with fiery amber core
    const hAlphaRed = vec3(1, 0.06, 0.12)
    const hAlphaAmber = vec3(1, 0.52, 0.04)
    const prominenceColor = mix(hAlphaRed, hAlphaAmber, loopArc.pow(2))
    // Set colorNode to deep black so external studio key lights do not wash out internal plasma radiance
    this.colorNode = color(hsl.integer(20, 37, 2))
    this.metalness = 0
    this.roughness = 1
    this.clearcoat = 0
    // Soft chromospheric EUV limb brightening
    const limbEUV = grazing.pow(2.2).mul(0.45)
    const limbColor = vec3(1, 0.45, 0.08).mul(limbEUV)
    // Thermonuclear self-emission driven purely by Planck radiation and plasma energetics
    this.emissiveNode = blackbodyRadiance
      .mul(near.mul(0.2).add(0.85))
      .mul(1.2)
      .add(prominenceColor.mul(prominenceGlow).mul(1.8))
      .add(limbColor.mul(facing.mul(0.4).add(0.6)))
      .add(vec3(1, 0.95, 0.8).mul(faculae).mul(1.4))
      .add(vec3(1, 0.85, 0.5).mul(domeIntensity.pow(3)).mul(intimate).mul(0.5))
  }
}
