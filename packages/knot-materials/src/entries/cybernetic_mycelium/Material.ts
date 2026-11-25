import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_vec3, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {refractedParallax} from '../../candidates/gemini_argon/lib/refractedParallax.ts'
import {voronoi} from '../../candidates/gemini_argon/lib/voronoi3dStruct.ts'
import {beads} from '../../lib/beads.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {displacementView} from '../../lib/displacementView.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Bio-digital Panellus stipticus mycelium and neural ganglia network colonizing a rippled liquid-mercury core, crowned with vertex-displaced spherical guttation dew droplets and synaptic impulse trains. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = knotData.id
    const p = positionGeometry
    const dispView = displacementView()
// Organic domain warp for anastomosing 3D mycelial cord networks
    const bioWarp = mx_fractal_noise_vec3(p.mul(5.2).add(1.9), 3, 2.15, 0.52).mul(0.55)
    const primaryVoro = voronoi(p.mul(13).add(bioWarp), 0.92)
    const primaryCord = primaryVoro.border.smoothstep(0.052, 0.006)
    const ganglionSoma = primaryVoro.distance.smoothstep(0.2, 0.04)
// Spherical guttation metabolite dew droplets sitting on the mycelial surface (beads.core is derivative-free for vertex use)
    const dewBeads = beads(p.mul(22), 17.3)
    const vertexBulge = primaryCord.mul(0.0038)
      .add(ganglionSoma.mul(0.0045))
      .add(dewBeads.core.mul(0.0055))
      .mul(dispView.near.mul(0.35).add(0.65))
    this.positionNode = p.add(normalLocal.mul(vertexBulge))
    const {view, facing, grazing, rim, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
// Multi-depth refracted parallax for secondary and tertiary subsurface hyphae
    const subP1 = refractedParallax(p, n, view, 0.016, 1.38)
    const subP2 = refractedParallax(p, n, view, 0.038, 1.38)
    const warp1 = mx_fractal_noise_vec3(subP1.mul(9.5).sub(4.7), 2, 2.1, 0.5).mul(0.45)
    const secondaryVoro = voronoi(subP1.mul(26).add(warp1).add(11.3), 0.9)
    const secondaryHyphae = secondaryVoro.border.smoothstep(0.042, 0.005).mul(near.mul(0.65).add(0.35))
    const secondaryNode = secondaryVoro.distance.smoothstep(0.18, 0.035)
// Deep tertiary micro-capillary filaments and reaction-diffusion Turing rings (visible up close)
    const deepField = mx_noise_float(subP2.mul(48).add(warp1.mul(2))).sub(mx_noise_float(subP2.mul(24).sub(time.mul(0.2))))
    const tertiaryCapillaries = filament(deepField, 0.035).mul(intimate.mul(0.8).add(0.2))
    const deepVoro = voronoi(subP2.mul(18).add(31.1), 0.9)
    const deepWeb = deepVoro.border.smoothstep(0.045, 0.006).mul(0.55)
// Traveling synaptic action-potential spikes racing along the Voronoi border edges toward the soma nodes
    const impulsePhase1 = primaryVoro.distance.mul(TAU * 4.5).sub(time.mul(5.2)).add(primaryVoro.random.x.mul(TAU))
    const synapticPulse1 = impulsePhase1.sin().mul(0.5).add(0.5).pow(6).mul(primaryCord)
    const impulsePhase2 = secondaryVoro.distance.mul(TAU * 5.5).sub(time.mul(6.8)).add(secondaryVoro.random.y.mul(TAU))
    const synapticPulse2 = impulsePhase2.sin().mul(0.5).add(0.5).pow(7).mul(secondaryHyphae)
// Proximity-excited neural cascade wave sweeping across the entire knot
    const globalWavePhase = p.dot(vec3(0.62, -0.51, 0.59)).mul(11).sub(time.mul(1.8))
    const globalCascade = hairline(globalWavePhase.sin(), 0.065).mul(near.mul(0.75).add(0.25))
// Rippled liquid-mercury / obsidian ferrofluid substrate between the mycelial cords
    const totalTissueMask = primaryCord.max(ganglionSoma).max(secondaryHyphae.mul(0.72)).max(dewBeads.mask)
    const mercuryExposure = totalTissueMask.oneMinus()
    const fluidNormal = liquidNormal(near.mul(1.5).add(0.45), 0.95)
// Chitinous biopolymer iridescence on the fungal cords vs dark mirror chrome on the liquid substrate
    const bioIridescence = cosinePalette(grazing.mul(2.2).add(primaryVoro.random.z), [0.35, 0.48, 0.42], [0.32, 0.42, 0.38], [1, 1, 1], [0.15, 0.45, 0.72])
    const hyphaeAlbedo = mix(color(hsl.integer(185, 54, 8)), color(hsl.integer(175, 75, 28)), primaryCord.mul(0.7).add(secondaryHyphae.mul(0.3)))
      .add(bioIridescence.mul(0.15))
    const ganglionAlbedo = mix(color(hsl.integer(316, 71, 11)), color(hsl.integer(321, 85, 39)), primaryVoro.random.y)
    const mercuryAlbedo = mix(color(hsl.integer(266, 26, 6)), color(hsl.integer(258, 31, 25)), grazing.pow(1.4))
// Spherical guttation droplets tinted in golden amber or electric magenta-cyan
    const dropletTint = mix(color(hsl.integer(57.4, 100, 71)), color(hsl.integer(349, 100, 61.4)), dewBeads.random.x)
    let surfaceColor: Node<'vec3'> = mix(mercuryAlbedo, hyphaeAlbedo, primaryCord.max(secondaryHyphae.mul(0.72)))
    surfaceColor = mix(surfaceColor, ganglionAlbedo, ganglionSoma.mul(0.88))
    surfaceColor = mix(surfaceColor, dropletTint.mul(0.45), dewBeads.mask)
    this.colorNode = surfaceColor
// Metallic liquid-mercury substrate vs dielectric wet chitinous mycelium and refractive dew beads
    this.metalnessNode = mix(float(0.95), float(0.15), totalTissueMask)
    this.roughnessNode = mix(float(0.04), float(0.2).sub(dewBeads.mask.mul(0.17)), totalTissueMask)
    this.clearcoat = 0.92
    this.clearcoatRoughnessNode = mix(float(0.01), float(0.055), primaryCord.mul(dewBeads.mask.oneMinus()))
// Velvet-like micro-spores on the fungal hyphae at grazing angles
    this.sheen = 0.28
    this.sheenColor.set(hsl.integer(167, 100, 88.5))
    this.sheenRoughness = 0.45
    this.iridescenceNode = totalTissueMask.mul(0.78)
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = grazing.mul(280).add(primaryVoro.random.x.mul(160)).add(140)
// Combine analytic fluid normals on the mercury substrate with crisp 3D relief normals on the hyphae and dew caps
    const tissueHeight = vertexBulge
      .add(primaryCord.mul(0.003))
      .add(ganglionSoma.mul(0.0036))
      .add(secondaryHyphae.mul(0.0015))
      .add(dewBeads.cap.mul(dewBeads.mask).mul(0.0052))
    const tissueNormal = proceduralNormal(tissueHeight, 1.15)
    const combinedNormal = mix(fluidNormal, tissueNormal, totalTissueMask.mul(0.84).add(0.16)).normalize()
    this.normalNode = combinedNormal
// Bioluminescent synaptic firing, glowing soma ganglia, subsurface capillary webs, and caustics inside the dew beads
    const foxfireGreen = color(hsl.integer(147.7, 100, 85.18))
    const synapseCyan = color(hsl.integer(217, 100, 78))
    const somaMagenta = color(hsl.integer(350.5, 100, 60.8))
    const amberFire = color(hsl.integer(63, 100, 73.3))
    const cordColor = mix(foxfireGreen, synapseCyan, primaryVoro.random.z)
    const subCordColor = mix(somaMagenta, amberFire, secondaryVoro.random.x)
    const somaHeartbeat = time.mul(3.2).add(primaryVoro.random.z.mul(TAU)).sin().mul(0.35).add(0.75)
    const somaEmission = mix(somaMagenta, amberFire, primaryVoro.random.x)
      .mul(ganglionSoma.add(secondaryNode.mul(0.65)))
      .mul(somaHeartbeat)
// Focused optical caustic inside each spherical guttation droplet
    const beadCaustic = dewBeads.cap.pow(3).mul(dewBeads.mask).mul(facing.mul(0.6).add(0.4))
    const wetSparkle = glints(combinedNormal, 220).mul(dewBeads.mask.mul(1.4).add(mercuryExposure.mul(0.45)))
    this.emissiveNode = cordColor.mul(primaryCord.mul(0.42).add(deepWeb.mul(0.28)))
      .add(subCordColor.mul(secondaryHyphae.mul(0.55)))
      .add(synapseCyan.mul(synapticPulse1.mul(2.4)))
      .add(amberFire.mul(synapticPulse2.mul(2.2)))
      .add(somaEmission.mul(2.5))
      .add(mix(foxfireGreen, somaMagenta, 0.5).mul(tertiaryCapillaries).mul(1.1))
      .add(somaMagenta.mul(globalCascade).mul(totalTissueMask).mul(1.8))
      .add(dropletTint.mul(beadCaustic).mul(2.8))
      .add(foxfireGreen.mul(rim.pow(2.4)).mul(0.42))
      .add(color(hsl.integer(176, 100, 97.8)).mul(wetSparkle).mul(0.65))
  }
}
