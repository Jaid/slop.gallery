import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, cameraWorldMatrix, color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {tubeMetric} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {wavelengthColor} from '../../candidates/gemini_argon/lib/wavelengthColor.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {displacementView} from '../../lib/displacementView.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Relativistic Kerr accretion knot and Einstein gravitational lens. The core traps all incident light inside an event horizon while a multi-tiered plasma disk undergoes relativistic Doppler beaming and bends background starfields around the photon sphere. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.22)
    this.name = knotData.id
    const tube = uv()
    const metric = tubeMetric(tube)
    const dispView = displacementView()
// Magnetohydrodynamic spiral waves along the knot centerline and poloidal circumference
    const spiralPhase = tube.x.mul(TAU * 9).add(tube.y.mul(TAU * 3)).sub(time.mul(2.4))
    const counterPhase = tube.x.mul(TAU * 15).sub(tube.y.mul(TAU * 2)).add(time.mul(1.7))
    const mhdTurbulence = mx_fractal_noise_float(positionGeometry.mul(8.5).add(vec3(time.mul(0.35), time.mul(-0.28), time.mul(0.2))), 4, 2.1, 0.52)
    const ridgeWave = spiralPhase.add(mhdTurbulence.mul(1.8)).sin().mul(0.5).add(0.5)
    const SecondaryWave = counterPhase.add(mhdTurbulence.mul(1.2)).sin().mul(0.5).add(0.5)
// Relativistic bulge where grazing magnetic flux tubes erupt outward
    const fluxHeight = ridgeWave.pow(2.5).mul(0.0085).add(SecondaryWave.pow(3).mul(0.0035)).mul(dispView.grazing.pow(0.8).mul(0.75).add(0.25))
    this.positionNode = positionGeometry.add(normalLocal.mul(fluxHeight))
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const V = positionViewDirection
    const T = tangentView.normalize()
    const B = vec3(bitangentView as unknown as Node<'vec3'>).normalize()
// Relativistic orbital velocity vector along the helical accretion stream
    const streamDir = T.mul(0.88).add(B.mul(0.47)).normalize()
    const betaDotV = streamDir.dot(V).clamp(-0.95, 0.95)
// Relativistic Doppler factor D = 1 / (gamma * (1 - beta * cos(theta))) with beta ~ 0.46c
    const dopplerFactor = float(1).div(float(1).sub(betaDotV.mul(0.46)).mul(1.125)).clamp(0.52, 2.15)
// Multi-depth parallax into the accretion flow and deep behind the event horizon
    const lensDeflection = float(1).div(facing.max(0.085)).sub(0.85).clamp(0, 9.5)
    const viewWorld = V.negate().transformDirection(cameraWorldMatrix).normalize()
    const normalWorldDir = normalViewGeometry.transformDirection(cameraWorldMatrix).normalize()
// Gravitational ray deflection: bends the background sky around the knot's silhouette
    const lensedDirPrimary = viewWorld.add(normalWorldDir.mul(lensDeflection.mul(0.38))).normalize()
    const lensedDirEinstein = viewWorld.sub(normalWorldDir.mul(lensDeflection.mul(0.72))).normalize()
// Deep lensed background universe: twin Einstein-ring starfields + deep cosmic nebula
    const starsPrimary = starfield(lensedDirPrimary, 26, 0.74)
    const starsSecondary = starfield(lensedDirEinstein, 42, 0.79).mul(grazing.pow(1.4))
    const nebulaField = mx_fractal_noise_float(lensedDirPrimary.mul(3.8).add(vec3(1.7, -2.4, 0.9)), 4, 2.15, 0.5).mul(0.5).add(0.5)
    const nebulaColor = cosinePalette(nebulaField.add(betaDotV.mul(0.18)), [0.06, 0.04, 0.11], [0.09, 0.07, 0.16], [1, 1, 1], [0.62, 0.18, 0.82]).max(0)
    const lensedCosmos = nebulaColor.mul(nebulaField.pow(1.8)).add(starsPrimary.mul(2.4)).add(starsSecondary.mul(3.2))
// Multi-layered accretion disk filaments in metric tube coordinates with parallax
    const raySlope = vec2(V.dot(T), V.dot(B)).div(vec2(7.177, 0.8168)).div(facing.max(0.24))
    const sampleDiskLayer = (depth: number, scaleAlong: number, scaleAround: number, speed: number, seed: number): Node<'float'> => {
      const parUv = metric.sub(raySlope.mul(depth))
      const flowPhase = parUv.x.mul(scaleAlong).add(parUv.y.mul(scaleAround)).sub(time.mul(speed))
      const warp = mx_fractal_noise_float(p.sub(view.mul(depth)).mul(11).add(seed), 3, 2.1, 0.52)
      const ribbon = filteredRibbon(flowPhase.add(warp.mul(2.2)).sin(), 0.18)
      const fineSub = hairline(flowPhase.mul(3).add(warp.mul(4.5)).sin(), 0.08).mul(near.mul(0.75).add(0.25))
      return ribbon.mul(0.72).add(fineSub.mul(0.58))
    }
    const outerDisk = sampleDiskLayer(0.004, 3.5, 14, 2.8, 1.1)
    const midDisk = sampleDiskLayer(0.018, 5.2, 22, 3.9, 7.4)
    const innerPhotonDisk = sampleDiskLayer(0.038, 8.5, 34, 5.4, 19.8)
// Accretion temperature profile and Doppler wavelength shift (580 nm rest -> 415 nm blue / 695 nm red)
    const diskDensity = outerDisk.mul(0.52).add(midDisk.mul(0.38)).add(innerPhotonDisk.mul(0.45)).mul(grazing.pow(0.65).mul(0.85).add(0.15))
    const shiftedWavelength = float(575).div(dopplerFactor.pow(0.58)).sub(innerPhotonDisk.mul(55)).clamp(395, 705)
    const relativisticSpectrum = wavelengthColor(shiftedWavelength).mul(vec3(1.25, 1.05, 1.35))
    const blackbodyCore = mix(color(hsl.integer(33.6, 100, 59.8)), color(hsl.integer(79, 100, 97.2)), diskDensity.mul(dopplerFactor.mul(0.55)).clamp())
    const plasmaTint = mix(relativisticSpectrum, blackbodyCore, 0.48).mul(dopplerFactor.pow(2.4))
// Critical photon sphere ring at grazing angle (facing ~ 0.24) + secondary lensed ghost ring (facing ~ 0.11)
    const photonRingPrimary = filteredRibbon(facing.sub(0.23).add(mhdTurbulence.mul(0.035)), 0.028)
    const photonRingGhost = hairline(facing.sub(0.105).sub(mhdTurbulence.mul(0.02)), 0.012)
    const photonRingTotal = photonRingPrimary.add(photonRingGhost.mul(1.35))
// Hawking quantum horizon micro-caustics revealed at intimate viewing distance
    const hawkingLattice = p.sub(view.mul(0.025)).mul(48)
    const hawkingCell = mx_noise_float(hawkingLattice.add(time.mul(1.4))).sub(mx_noise_float(hawkingLattice.mul(1.7).sub(time.mul(1.9))))
    const hawkingSparks = hairline(hawkingCell, 0.035).mul(intimate).mul(facing.pow(1.5))
// Event horizon core absorption: facing surfaces collapse into a light-swallowing singularity
    const horizonMask = facing.smoothstep(0.18, 0.62)
    const baseAlbedo = mix(color(hsl.integer(299, 44, 3.4)), color(hsl.integer(0, 0, 0)), horizonMask)
    this.colorNode = baseAlbedo
    this.metalness = 0.05
    this.roughnessNode = mix(float(0.03), float(0.22), diskDensity.clamp()).mul(horizonMask.oneMinus().mul(0.7).add(0.3))
    this.specularIntensityNode = horizonMask.oneMinus().pow(2).mul(0.85)
    this.clearcoatNode = rim.mul(0.95).add(0.05)
    this.clearcoatRoughness = 0.015
// Spacetime curvature normal perturbation
    const heightField = fluxHeight.add(outerDisk.mul(0.0018)).sub(innerPhotonDisk.mul(0.0012)).add(photonRingPrimary.mul(0.0015))
    this.normalNode = proceduralNormal(heightField, 0.95)
// Total relativistic radiance: lensed cosmos in the shadow + Doppler-beamed plasma + photon ring + Hawking sparks
    const photonGold = mix(color(hsl.integer(62, 100, 74.8)), color(hsl.integer(225, 100, 87.4)), betaDotV.mul(0.5).add(0.5))
    const emissive = lensedCosmos.mul(horizonMask.mul(0.75).add(0.25))
      .add(plasmaTint.mul(diskDensity).mul(1.95))
      .add(photonGold.mul(photonRingTotal).mul(dopplerFactor.pow(1.8)).mul(3.4))
      .add(color(hsl.integer(213, 100, 85.5)).mul(hawkingSparks).mul(1.8))
      .add(relativisticSpectrum.mul(rim.pow(2.2)).mul(dopplerFactor.pow(2)).mul(0.75))
    this.emissiveNode = emissive
  }
}
