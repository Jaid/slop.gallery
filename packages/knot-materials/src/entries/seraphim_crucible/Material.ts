import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, Fn, interleavedGradientNoise, Loop, mix, modelWorldMatrixInverse, mx_atan2, mx_cell_noise_float, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, refract, screenCoordinate, select, time, transformNormalToView, uv, vec2, vec3, vec4} from 'three/tsl'

import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {knotTubeRadius} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Filtered periodic signal that settles to its mean when sub-pixel. */
function filteredCos(phase: Node<'float'>, fadeStart = 0.55, fadeEnd = 2.6) {
  const visibility = phase.fwidth().smoothstep(fadeStart, fadeEnd).oneMinus()
  return phase.cos().mul(visibility)
}
/** Anti-aliased engraving line from an unwrapped footprint. */
function engravedLine(field: Node<'float'>, width: number, footprint: Node<'float'>) {
  const aa = footprint.max(0.00001)
  const coverage = field.abs().smoothstep(width, aa.add(width)).oneMinus()
  const survival = float(width * 2.2).div(aa).min(1)
  return coverage.mul(survival)
}
/** Raised-cosine lobe on a periodic phase: 1 on the crest, 0 in the trough, with no harmonic above `sharpness`. */
function lobe(phase: Node<'float'>, sharpness: number) {
  return phase.cos().mul(0.5).add(0.5).pow(sharpness)
}
/** Round pyrite grain per cell of a jittered lattice: the center stays in [0.25, 0.75] and the support radius at most 0.24, so no grain ever touches a cell wall. */
function pyriteGrains(position: Node<'vec3'>, cellSize: number) {
  const q = position.div(cellSize)
  const rnd = cellNoiseVec3(q.floor())
  const outer = q.fwidth().length().add(0.18).min(0.24)
  const grain = q.fract().sub(rnd.mul(0.5).add(0.25)).length().smoothstep(0.06, outer).oneMinus()
  return grain.mul(rnd.z.smoothstep(0.62, 0.78))
}
/** Blackbody solar plasma ramp from deep crimson-umbral red to blinding photosphere white-gold. */
function solarBlackbody(heat: Node<'float'>) {
  const deep = mix(color(hsl.integer(34, 86, 5.4)), color(hsl.integer(31, 99, 31.4)), heat.smoothstep(0, 0.32))
  const mid = mix(deep, color(hsl.integer(40.4, 100, 63.4)), heat.smoothstep(0.24, 0.62))
  const bright = mix(mid, color(hsl.integer(88, 100, 86)), heat.smoothstep(0.55, 0.88))
  return mix(bright, color(hsl.integer(96, 100, 99.2)), heat.smoothstep(0.82, 1.18))
}
/** An ancient celestial astrolabe and Dyson-sphere reliquary forged from burnished orichalcum and deep cobalt-lapis enamel, caging a miniature boiling star. As the viewer approaches, the mechanical iris louvers slide open and lift to reveal the magnetic coronal loops inside. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const tube = uv()
    const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const objectDistance = cameraLocal.length()
    const proximity = objectDistance.smoothstep(1.05, 4.8).oneMinus()
    const loopAngle = time.mul(Math.PI)
// Mechanical astrolabe architecture on (u, v):
// 36 longitudinal ring segments, 6 radial ribs, plus 2 counter-winding helical astrolabe bands.
    const ringCount = 36
    const ribCount = 6
    const ringPhase = tube.x.mul(TAU * ringCount)
    const ribPhase = tube.y.mul(TAU * ribCount)
    const helixAPhase = tube.x.mul(TAU * 5).add(tube.y.mul(TAU * 2)).sub(loopAngle)
    const helixBPhase = tube.x.mul(TAU * 7).sub(tube.y.mul(TAU * 3)).add(loopAngle)
// Proximity-driven iris aperture: shutters open wider as you step closer.
    const shutterThreshold = proximity.mul(0.48).sub(0.06)
    const ringWave = ringPhase.cos()
    const ribWave = ribPhase.cos()
    const helixAWave = helixAPhase.cos()
    const helixBWave = helixBPhase.cos()
// Vertex displacement: raised gimbal rings, ribs and helical bands.
// Vertices are 2.8 cm apart along the knot and 1.3 cm around it, far coarser than the 1–2 cm bevels of the struts, so the geometry only carries a smooth swell under each strut; the sharp strut edges, bevels and iris shutters stay in the per-pixel relief below.
    const surface = (at: Node<'vec2'>) => {
      const frame = knotFrame(at)
      const ringArch = lobe(at.x.mul(TAU * ringCount), 1)
      const ribArch = lobe(at.y.mul(TAU * ribCount), 2)
      const hA = lobe(at.x.mul(TAU * 5).add(at.y.mul(TAU * 2)).sub(loopAngle), 4)
      const hB = lobe(at.x.mul(TAU * 7).sub(at.y.mul(TAU * 3)).add(loopAngle), 4)
      const lattice = ringArch.mul(0.65).add(ribArch.mul(0.5)).add(hA.mul(0.85)).add(hB.mul(0.7))
      return frame.center.add(frame.normal.mul(lattice.mul(0.0075).add(knotTubeRadius)))
    }
    this.positionNode = surface(tube)
    const eu = vec2(0.00025, 0)
    const ev = vec2(0, 0.0018)
    const du = surface(tube.add(eu)).sub(surface(tube.sub(eu)))
    const dv = surface(tube.add(ev)).sub(surface(tube.sub(ev)))
    const rawNormal = du.cross(dv).normalize()
    const baseNormal = select(rawNormal.dot(normalLocal).greaterThan(0), rawNormal, rawNormal.negate())
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
// Derivative-filtered armor and aperture masks in fragment stage.
    const ringFootprint = ringPhase.fwidth().max(0.0001)
    const ribFootprint = ribPhase.fwidth().max(0.0001)
    const hAFootprint = helixAPhase.fwidth().max(0.0001)
    const hBFootprint = helixBPhase.fwidth().max(0.0001)
    const ringStrut = ringWave.smoothstep(shutterThreshold.sub(ringFootprint.mul(0.8)), shutterThreshold.add(ringFootprint.mul(0.8)).min(0.95))
    const ribStrut = ribWave.smoothstep(float(0.62).sub(ribFootprint.mul(0.8)), float(0.66).add(ribFootprint.mul(0.8)))
    const helixAStrut = helixAWave.smoothstep(float(0.77).sub(hAFootprint.mul(0.8)), float(0.81).add(hAFootprint.mul(0.8)))
    const helixBStrut = helixBWave.smoothstep(float(0.81).sub(hBFootprint.mul(0.8)), float(0.85).add(hBFootprint.mul(0.8)))
// Beveled golden borders around every strut and helical band.
    const ringBevel = engravedLine(ringWave.sub(shutterThreshold), 0.09, ringFootprint)
    const helixBevel = engravedLine(helixAWave.sub(0.79), 0.045, hAFootprint).max(engravedLine(helixBWave.sub(0.83), 0.045, hBFootprint))
    const ribBevel = engravedLine(ribWave.sub(0.64), 0.055, ribFootprint)
    const bezelRim = ringBevel.max(helixBevel).max(ribBevel).clamp()
    const armorMask = ringStrut.max(ribStrut).max(helixAStrut).max(helixBStrut).clamp()
    const windowMask = armorMask.oneMinus()
// Astrolabe degree ticks, sacred geometric circles, and celestial calligraphy on the gold & lapis armor.
    const gridUV = vec2(tube.x.mul(ringCount), tube.y.mul(ribCount * 3))
    const gridFootprint = gridUV.fwidth().length().max(0.0001)
    const cellId = gridUV.floor()
    const cellLocal = gridUV.fract().sub(0.5)
    const cellRadius = cellLocal.length()
    const cellSeed = mx_cell_noise_float(vec3(cellId.mod(vec2(ringCount, ribCount * 3)), 19.3))
    const astrolabeCircle = engravedLine(cellRadius.sub(0.32), 0.022, gridFootprint).add(engravedLine(cellRadius.sub(0.18), 0.016, gridFootprint).mul(cellSeed.smoothstep(0.25, 0.75)))
    const tickPhase = tube.x.mul(TAU * ringCount * 12)
    const tickMarks = filteredCos(tickPhase, 0.4, 2.2).smoothstep(0.65, 0.92).mul(ringBevel)
    const crossHair = engravedLine(cellLocal.x, 0.014, gridFootprint).max(engravedLine(cellLocal.y, 0.014, gridFootprint)).mul(cellRadius.smoothstep(0.14, 0.34))
    const inlayPattern = astrolabeCircle.max(tickMarks).max(crossHair).clamp()
// Lapis lazuli enamel recessed panels vs raised burnished gold.
    const recessedPanel = ringWave.smoothstep(shutterThreshold.add(0.16), shutterThreshold.add(0.28)).mul(ribStrut.oneMinus()).mul(helixAStrut.oneMinus()).mul(helixBStrut.oneMinus())
// Pyrite gold flecks inside the cobalt-lapis enamel.
    const pyriteSpark = pyriteGrains(p, 1 / 95).mul(near)
    const lapisColor = mix(color(hsl.integer(261, 73, 12)), color(hsl.integer(258, 77, 26.5)), mx_noise_float(p.mul(24)).mul(0.5).add(0.5)).add(color(hsl.integer(91, 67, 84.3)).mul(pyriteSpark.mul(0.55)))
// Brushed anisotropic gold with subtle warm copper-rose variation along the knot.
// The 2 mm brush period fades out before it gets closer than ~6 px, so its relief never aliases into stripes along the tube.
    const brushWave = filteredCos(tube.y.mul(TAU * 420), 0.3, 1.05).mul(near)
    const goldBase = mix(color(hsl.integer(74, 79, 64)), color(hsl.integer(88, 100, 90.2)), helixAStrut.max(bezelRim).mul(0.55).add(brushWave.mul(0.06)).add(0.25))
    const armorColor = mix(goldBase, lapisColor, recessedPanel.mul(inlayPattern.oneMinus()))
// Shutters lift outward at the edges of the apertures when the viewer approaches.
    const gazeAlignment = baseNormal.dot(view).smoothstep(-0.2, 0.85)
    const openAmount = proximity.mul(0.65).add(gazeAlignment.mul(0.35))
    const rimLift = ringPhase.sin().abs().smoothstep(0.55, 0.92).mul(openAmount).mul(0.0045)
// Fine micro-relief for the engravings, recessed enamel and iris shutters, blended with the vertex-displaced normal.
    const microRelief = rimLift.add(bezelRim.mul(0.0022)).add(inlayPattern.mul(0.0014)).sub(recessedPanel.mul(0.0018)).add(brushWave.mul(0.00018))
    const vertexViewNormal = transformNormalToView(baseNormal).normalize()
    const bumpViewNormal = proceduralNormal(microRelief, 0.75)
    const viewNormal = vertexViewNormal.add(bumpViewNormal.mul(0.45)).normalize()
    this.normalNode = viewNormal
// Volumetric ray-marched solar core inside the crucible apertures:
// Boiling convective photosphere granules, twisted coronal magnetic flux ropes, and blinding solar flares.
    const solarVolume = Fn(() => {
      const enterDir = refract(view.negate(), baseNormal, float(1 / 1.56)).normalize()
      const steps = 16
      const stepSize = facing.mul(0.18).add(0.16).div(steps)
      const jitter = interleavedGradientNoise(screenCoordinate)
      const rayPos = positionGeometry.add(enterDir.mul(jitter.mul(stepSize).add(0.012))).toVar()
      const accumLight = vec3(0).toVar()
      const transmittance = float(1).toVar()
      const detail = near.mul(0.75).add(0.25)
      Loop({
        start: 0,
        end: steps,
        type: 'int',
      }, () => {
        const flowWarp = mx_noise_vec3(rayPos.mul(4.8).add(vec3(loopAngle.cos().mul(0.45), loopAngle.sin().mul(0.45), 1.7))).mul(0.055)
        const q = rayPos.add(flowWarp)
// Twisted magnetic flux ropes and coronal prominences.
        const ropeA = mx_noise_float(q.mul(9.5).add(vec3(loopAngle.cos().mul(0.8), loopAngle.sin().negate().mul(0.8), 3.2)))
        const ropeB = mx_noise_float(q.mul(21).sub(vec3(loopAngle.sin().mul(0.9), loopAngle.cos().mul(0.9), -4.1)))
        const filamentA = float(1).sub(ropeA.abs().mul(6.2)).max(0).pow(2.4)
        const filamentB = float(1).sub(ropeB.abs().mul(6.8)).max(0).pow(2.6).mul(detail)
// Convective photosphere granulation at deeper strata.
        const granulation = mx_noise_float(q.mul(14).add(vec3(0, loopAngle.cos().mul(0.5), 0))).mul(0.5).add(0.5)
        const sunspotMask = granulation.smoothstep(0.22, 0.68)
        const coreProximity = float(1).sub(transmittance).smoothstep(0, 0.85)
        const plasmaDensity = filamentA.mul(0.85).add(filamentB.mul(0.65)).add(coreProximity.mul(sunspotMask).mul(0.5))
// Temperature rises toward the core and along magnetic reconnection filaments, amplified by viewer proximity.
        const flareBoost = proximity.mul(0.28).add(intimate.mul(0.22))
        const heat = coreProximity.mul(0.35).add(filamentA.mul(0.85)).add(filamentB.mul(0.5)).add(flareBoost.mul(0.6)).mul(sunspotMask.mul(0.65).add(0.35))
        const emissionColor = solarBlackbody(heat)
// Volumetric self-shadowing from cooler dark coronal dust/umbral filaments.
// The medium stays optically thin enough that filaments add up against the cooler background instead of every ray saturating to the same white-gold source color.
        const extinction = plasmaDensity.mul(7).add(sunspotMask.oneMinus().mul(9))
        accumLight.addAssign(emissionColor.mul(plasmaDensity).mul(transmittance).mul(stepSize).mul(42))
        transmittance.mulAssign(extinction.mul(stepSize).negate().exp())
        rayPos.addAssign(enterDir.mul(stepSize))
      })
// Deep inner stellar furnace core behind the raymarch steps, glowing orange so the hotter filaments in front of it still read.
      const furnaceCore = solarBlackbody(float(0.5).add(proximity.mul(0.2))).mul(1.15)
      return accumLight.add(furnaceCore.mul(transmittance))
    })
// Subsurface scattering and golden rim incandescence where the inner star backlights the shutter edges.
    const apertureEdgeGlow = ringWave.sub(shutterThreshold).abs().smoothstep(0, 0.16).oneMinus().mul(armorMask)
    const edgeIncandescence = mix(color(hsl.integer(35.4, 100, 60.5)), color(hsl.integer(89, 100, 88)), apertureEdgeGlow.pow(2)).mul(apertureEdgeGlow).mul(proximity.mul(1.4).add(0.6))
// Celestial runes glowing softly in the engraved channels when the core flares.
    const runeGlow = mix(color(hsl.integer(43.6, 100, 65.3)), color(hsl.integer(95, 100, 94.6)), proximity).mul(inlayPattern).mul(armorMask).mul(recessedPanel.oneMinus()).mul(proximity.mul(0.85).add(0.2))
// Custom cathedral-observatory studio environment with warm golden key lights and deep sapphire counter-fill.
    const observatorySky = panelSky({
      zenith: [0.02, 0.03, 0.08],
      horizon: [0.14, 0.09, 0.06],
      nadir: [0.015, 0.01, 0.02],
      glow: {
        color: [1, 0.58, 0.2],
        intensity: 0.55,
        width: 0.1,
      },
      panels: [{
        azimuth: 0.55,
        elevation: 0.58,
        halfWidth: 0.32,
        halfHeight: 0.24,
        color: [1, 0.91, 0.74],
        intensity: 8.5,
        panes: [4, 2],
      }, {
        azimuth: -0.9,
        elevation: 0.42,
        halfWidth: 0.045,
        halfHeight: 0.65,
        color: [0.58, 0.78, 1],
        intensity: 10.5,
      }, {
        azimuth: 2.35,
        elevation: 0.35,
        halfWidth: 0.42,
        halfHeight: 0.05,
        color: [1, 0.48, 0.22],
        intensity: 9,
      }, {
        azimuth: -2.4,
        elevation: 0.65,
        halfWidth: 0.2,
        halfHeight: 0.2,
        color: [0.85, 0.92, 1],
        intensity: 5.5,
      }, {
        azimuth: 0,
        elevation: 1.28,
        halfWidth: 0.85,
        halfHeight: 0.28,
        color: [1, 0.96, 0.9],
        intensity: 1.9,
        softness: 0.35,
      }],
    })
    this.envNode = proceduralEnvironment(observatorySky)
    const windowSapphireTint = color(hsl.integer(345, 25, 4))
    this.colorNode = mix(windowSapphireTint, armorColor, armorMask)
    this.metalnessNode = armorMask.mul(recessedPanel.mul(-0.78).add(0.96))
    this.roughnessNode = mix(float(0.025), mix(float(0.14), float(0.26), recessedPanel).sub(bezelRim.mul(0.07)).clamp(0.05, 0.35), armorMask)
    this.anisotropy = 0.72
    const angleUV = mx_atan2(cellLocal.y, cellLocal.x.add(1e-6)) as unknown as Node<'float'>
    this.anisotropyNode = vec2(angleUV.sin().negate(), angleUV.cos()).mul(armorMask.mul(0.65))
    this.ior = 1.62
    this.clearcoatNode = mix(float(1), recessedPanel.mul(0.75).add(0.15), armorMask)
    this.clearcoatRoughnessNode = mix(float(0.015), float(0.06), armorMask)
    const sparkle = glints(viewNormal, 180).mul(bezelRim.max(pyriteSpark)).mul(armorMask)
    const coronalRim = color(hsl.integer(48, 100, 68)).mul(grazing.pow(3.5)).mul(windowMask.mul(0.7).add(0.15)).mul(0.65)
    this.emissiveNode = solarVolume().mul(windowMask)
      .add(edgeIncandescence.mul(1.35))
      .add(runeGlow.mul(0.65))
      .add(color(hsl.integer(92, 100, 96.2)).mul(sparkle).mul(1.8))
      .add(coronalRim)
  }
}
