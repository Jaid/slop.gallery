import type {Node, Texture} from 'three/webgpu'

import {atan, color, float, Fn, interleavedGradientNoise, Loop, mix, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, refract, screenCoordinate, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const steps = 32
/** Four miniature Kerr singularities nestled inside the knot’s lobes and crossings. */
const singularities = [{
  axis: vec3(0.18, 0.95, -0.25).normalize(),
  center: vec3(0.24, 0.08, 0.11),
}, {
  axis: vec3(-0.62, 0.54, 0.57).normalize(),
  center: vec3(-0.23, 0.18, -0.12),
}, {
  axis: vec3(0.45, -0.68, 0.58).normalize(),
  center: vec3(0.02, -0.27, 0.14),
}, {
  axis: vec3(-0.28, -0.74, -0.61).normalize(),
  center: vec3(-0.04, 0.29, -0.16),
}] as const
const rShadow = 0.046
const rPhoton = 0.064
const rIsco = 0.074
const rOuter = 0.34
/** Relativistic blackbody + Doppler shift palette: crimson-amber on the receding side, electric cyan-white on the approaching side. */
function relativisticPlasma(heat: Node<'float'>, doppler: Node<'float'>) {
  const redshifted = mix(color('#4a0602'), mix(color('#ff3805'), color('#ffbe42'), heat.smoothstep(0.2, 0.75)), heat.smoothstep(0.05, 0.88))
  const blueshifted = mix(color('#122e8c'), mix(color('#18c8ff'), color('#ebfcff'), heat.smoothstep(0.2, 0.75)), heat.smoothstep(0.05, 0.88))
  const coreHot = color('#fff8ed').mul(heat.smoothstep(0.78, 1.18).pow(1.6))
  return mix(redshifted, blueshifted, doppler.mul(0.5).add(0.5)).add(coreHot)
}
/** Kerr-Newman black hole system and relativistic accretion disks trapped inside the knot: curved geodesic ray-marching with gravitational lensing, photon rings and Doppler beaming. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.28)
    this.name = knotData.id
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const geodesicVolume = Fn(() => {
      const enter = view.negate()
      const initialDir = refract(enter, normalLocal.normalize(), float(1 / 1.48)).normalize()
      const stepSize = facing.mul(0.34).add(0.38).div(steps)
      const jitter = interleavedGradientNoise(screenCoordinate)
      const pos = positionGeometry.add(initialDir.mul(jitter.mul(stepSize))).toVar()
      const dir = initialDir.toVar()
      const transmittance = float(1).toVar()
      const radiance = vec3(0).toVar()
      const minRadius = float(10).toVar()
      const loopAngle = time.mul(Math.PI)
      const detail = near.mul(0.8).add(0.2)
      Loop({
        start: 0,
        end: steps,
        type: 'int',
      }, () => {
        const warp = mx_noise_vec3(pos.mul(3.4).add(vec3(loopAngle.cos().mul(0.25), loopAngle.sin().mul(0.25), 2.1))).mul(0.065)
        const warpedPos = pos.add(warp)
// Multi-octave ridged multifractal relativistic plasma streams filling the knot volume.
        let streamRidged: Node<'float'> = float(0)
        for (let octave = 0;octave < 4;octave++) {
          const freq = [5.2, 11.8, 25, 52][octave]
          const n = mx_noise_float(warpedPos.mul(freq).add(vec3(octave * 3.1, 7.4 - octave * 1.9, loopAngle.cos().mul(0.35))))
          const sheet = float(1).sub(n.abs().mul(5.2)).max(0).pow(2)
          const weight = [0.48, 0.4, 0.34, 0.28][octave]
          streamRidged = streamRidged.add(sheet.mul(octave < 2 ? float(weight) : detail.mul(weight)))
        }
        const streamGas = streamRidged.smoothstep(0.45, 1.02).pow(2.1)
        const streamDust = mx_noise_float(warpedPos.mul(3.8).add(vec3(2.9, -1.7, 0))).mul(0.5).add(0.5).smoothstep(0.42, 0.78)
        const streamDoppler = warpedPos.x.mul(1.8).sub(warpedPos.z.mul(1.2)).clamp(-1, 1)
        const streamBody = relativisticPlasma(streamRidged.mul(0.85), streamDoppler)
        radiance.addAssign(streamBody.mul(streamGas).mul(transmittance).mul(stepSize).mul(26))
        transmittance.mulAssign(streamDust.mul(2.2).add(streamGas.mul(0.8)).mul(stepSize).mul(-9).exp())
        for (const [index, hole] of singularities.entries()) {
          const rel = warpedPos.sub(hole.center)
          const r = rel.length().max(0.015)
          minRadius.assign(minRadius.min(r))
// Event horizon shadow capture: rays crossing rShadow are swallowed by the singularity.
          const alive = r.smoothstep(rShadow * 0.88, rShadow * 1.08)
          transmittance.mulAssign(alive)
// Schwarzschild-like geodesic deflection: bend the ray toward the singularity proportional to 1/r^2.
          const toCenter = rel.negate().div(r)
          const bend = float(0.0028).div(r.mul(r).add(0.0034)).mul(stepSize)
          dir.assign(dir.add(toCenter.mul(bend)).normalize())
// Accretion disk coordinates in the hole's tilted equatorial plane.
          const height = rel.dot(hole.axis)
          const planar = rel.sub(hole.axis.mul(height))
          const diskR = planar.length().max(0.001)
          const diskThickness = diskR.mul(0.18).add(0.008)
          const slab = height.abs().div(diskThickness).pow(2).negate().exp()
          const radialWindow = diskR.smoothstep(rIsco, rIsco + 0.025).mul(diskR.smoothstep(rOuter, rOuter + 0.1).oneMinus())
// Spiral magnetorotational turbulence windings and sharp shocked plasma filaments.
          const phi = atan(planar.z, planar.x.add(1e-6))
          const spiralPhase = phi.mul(4).add(diskR.mul(72)).sub(loopAngle.mul(2)).add(index * 1.9)
          const spiralArm = spiralPhase.sin().mul(0.5).add(0.5).pow(2.4)
          const fineSpiral = phi.mul(9).sub(diskR.mul(145)).add(loopAngle.mul(3)).cos().mul(0.5).add(0.5).pow(2.6).mul(detail)
          const shockA = float(1).sub(mx_noise_float(planar.mul(28).add(vec3(loopAngle.cos().mul(0.45), height.mul(30), loopAngle.sin().mul(0.45)))).abs().mul(5.8)).max(0).pow(2.2)
          const shockB = float(1).sub(mx_noise_float(planar.mul(62).add(index * 4.7)).abs().mul(6.2)).max(0).pow(2.4).mul(detail)
          const density = slab.mul(radialWindow).mul(spiralArm.mul(0.45).add(fineSpiral.mul(0.35)).add(shockA.mul(0.8)).add(shockB.mul(0.7)))
// Relativistic orbital tangent velocity and Doppler beaming factor.
          const tangentVel = hole.axis.cross(planar).normalize()
          const beta = float(0.44).div(diskR.add(0.035).sqrt()).min(0.7)
          const approach = tangentVel.dot(dir.negate())
          const doppler = approach.mul(beta).mul(1.95).clamp(-1, 1)
          const beaming = float(1).add(doppler.mul(0.68)).pow(2.6)
          const innerHeat = float(1).sub(diskR.sub(rIsco).div(rOuter - rIsco).clamp()).pow(0.85)
          const heat = innerHeat.mul(0.65).add(shockA.mul(0.42)).add(shockB.mul(0.35))
          const plasmaColor = relativisticPlasma(heat, doppler)
// Relativistic polar astrophysical jet along the spin axis.
          const jetCone = r.mul(0.13).add(0.006)
          const jetProfile = diskR.div(jetCone).pow(2).negate().exp().mul(height.abs().smoothstep(0.03, 0.16))
          const jetPulse = height.abs().mul(38).sub(loopAngle.mul(3)).sin().mul(0.5).add(0.5)
          const jetColor = mix(color('#6b42ff'), color('#4ff2ff'), jetPulse).mul(jetProfile).mul(2.4)
          const stepEmission = plasmaColor.mul(density).mul(beaming).mul(42).add(jetColor)
          radiance.addAssign(stepEmission.mul(transmittance).mul(stepSize))
          transmittance.mulAssign(density.mul(stepSize).mul(-16).exp())
        }
        pos.addAssign(dir.mul(stepSize))
      })
// Sharp Einstein photon ring where minimum ray impact parameter skims the photon sphere rPhoton.
      const photonSkim = minRadius.sub(rPhoton).abs()
      const photonRing = float(0.00018).div(photonSkim.pow(2).add(0.00016)).mul(minRadius.smoothstep(rShadow * 0.88, rShadow * 1.06))
      const ringColor = mix(color('#ff8c3b'), color('#acf2ff'), dir.x.mul(0.5).add(0.5)).mul(photonRing).mul(1.05)
// Gravitationally lensed background starfield deflected by the final exiting ray direction.
      const lensedStars = starfield(dir, 34, 0.86).add(starfield(dir.add(11.4), 84, 0.91).mul(intimate.mul(0.75).add(0.25)))
      const deepVoid = mix(color('#020106'), color('#130728'), dir.y.mul(0.5).add(0.5))
      return radiance.add(ringColor).add(lensedStars.mul(3).add(deepVoid).mul(transmittance))
    })
    this.colorNode = color('#010103')
    this.metalness = 0
    this.roughness = 0.03
    this.ior = 1.54
    this.clearcoat = 1
    this.clearcoatRoughness = 0.012
    const hawkingRim = mix(color('#ff551c'), color('#22ccff'), view.x.mul(0.5).add(0.5)).mul(grazing.pow(3.2)).mul(0.38)
    this.emissiveNode = geodesicVolume().mul(facing.pow(0.28).mul(0.85).add(0.15)).add(hawkingRim)
  }
}
