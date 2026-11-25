import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_vec3, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, normalLocal, time, transformNormalToView, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {environmentHighlight} from '../../candidates/deepseek/lib/environment.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/deepseek/lib/sky.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/**
 * A salt pan at noon. Wide polygonal plates of halite ride above turquoise brine; their rims are
 * frosted with efflorescence and scattered cubic crystals. The sun in the procedural sky is the only
 * painter, so every turn of the knot moves a white-hot reflection across the wet cracks.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const baseNormal = transformNormalToView(n).normalize()
// Warp the plate lattice just enough to lose the geometry of a perfect Voronoi diagram.
    const warp = mx_fractal_noise_float(p.mul(2.2).add(vec3(8.4, -3.1, 5.6)), 3, 2.03, 0.52).mul(0.13)
    const q = p.mul(5.15).add(vec3(warp.mul(0.8), warp.mul(0.45), warp.mul(0.65)))
    const plates = mx_worley_noise_vec3(q, 1, 0)
    const border = plates.y.sub(plates.x)
    const plateEdge = border.smoothstep(0.025, 0.085)
    const brine = plateEdge.oneMinus()
    const rim = border.sub(0.07).div(0.036).pow2().negate().exp()
    const dome = plates.x.div(0.52).clamp().oneMinus().pow(0.6)
// Smaller dry polygons cross the broad plates like the second act of the same drought.
    const q2 = p.mul(15.5).add(vec3(warp.mul(1.7), warp.mul(1.1), warp.mul(1.4)))
    const smallField = mx_worley_noise_vec3(q2, 1, 0)
    const smallBorder = smallField.y.sub(smallField.x)
    const dryCrack = smallBorder.smoothstep(0.012, 0.04).oneMinus().mul(0.8)
    const crackMask = brine.max(dryCrack.mul(0.55))
// Salt is bone white, warmed by iron and cooled by the sky in the hollows.
    const tone = mx_fractal_noise_float(p.mul(2.9).add(12.8), 3, 2.02, 0.5).mul(0.5).add(0.5)
    const blush = mx_fractal_noise_float(p.mul(1.25).add(vec3(-6.7, 4.2, 9.1)), 2, 2.01, 0.6).mul(0.5).add(0.5)
    const plateIdentity = mx_cell_noise_vec3(q.floor())
    const plateTone = plateIdentity.x.smoothstep(0.15, 0.85).mul(0.16).add(0.9)
    const saltColor = mix(color(hsl.integer(88, 21, 82)), color(hsl.integer(88, 48, 93)), tone).mul(plateTone)
    const roseSalt = mix(saltColor, color(hsl.integer(38, 44, 76)), blush.smoothstep(0.46, 0.78).mul(0.82).add(plateIdentity.y.smoothstep(0.62, 0.88).mul(0.35)).clamp())
    const wetFilm = mx_fractal_noise_float(p.mul(1.85).add(21.5), 2, 2.02, 0.6).mul(0.5).add(0.5).smoothstep(0.56, 0.72)
    const wetSalt = mix(roseSalt, color(hsl.integer(169, 29, 78)), wetFilm.mul(0.32))
    const shadedSalt = mix(wetSalt, color(hsl.integer(104, 13, 69)), grazing.mul(0.3).add(0.1)).mul(rim.mul(0.1).oneMinus())
// Brine is dark turquoise at the center of a crack and pale aquamarine at the wet rim.
    const brineColor = mix(color(hsl.integer(208, 95, 42)), color(hsl.integer(180, 64, 79)), border.div(0.11).clamp().pow(0.7))
    const waterShift = mx_noise_float(p.mul(46).add(vec3(time.mul(0.012), 0, time.mul(-0.009)))).mul(0.5).add(0.5)
    const waterColor = mix(brineColor.mul(0.72), brineColor, waterShift)
// Efflorescence: a fine sugar crust on the raised rims and in wind-shadowed patches.
    const efflorescence = mx_fractal_noise_float(p.mul(18).add(31.2), 2, 2.2, 0.5).mul(0.5).add(0.5)
    const frost = efflorescence.smoothstep(0.55, 0.78).mul(rim.mul(0.6).add(0.4)).mul(0.6).mul(intimate.mul(0.35).add(0.65))
// Tiny hopper-grown halite cubes catch the sun when the visitor leans in.
    const crystalCoord = p.mul(54)
    const crystalCell = crystalCoord.floor()
    const crystalLocal = crystalCoord.fract().sub(0.5)
    const cheb = crystalLocal.x.abs().max(crystalLocal.y.abs()).max(crystalLocal.z.abs())
    const crystalBody = float(1).sub(cheb.div(0.23).clamp()).smoothstep(0, 0.16)
    const crystalIdentity = mx_cell_noise_vec3(crystalCell)
    const crystalGate = crystalIdentity.x.smoothstep(0.52, 0.74).mul(crystalIdentity.y.smoothstep(0.15, 0.42))
    const crystalFade = crystalCoord.fwidth().length().smoothstep(0.35, 1.1).oneMinus()
    const crystalGrain = mx_fractal_noise_float(p.mul(96).add(4.3), 2, 2.2, 0.5).mul(0.5).add(0.5)
    const grainMask = crystalGrain.smoothstep(0.45, 0.8).mul(intimate).mul(0.35)
    const ripple = mx_noise_float(p.mul(150).add(vec3(time.mul(0.02), time.mul(-0.015), time.mul(0.01)))).mul(0.5).add(0.5)
    const crystals = crystalBody.mul(crystalGate).mul(crystalFade).mul(intimate.mul(1.2).add(0.08)).mul(brine.oneMinus()).clamp()
    const saltMask = crackMask.oneMinus()
    this.colorNode = mix(mix(shadedSalt, color(hsl.integer(96, 100, 99.2)), frost), waterColor, crackMask).mul(crystals.mul(0.1).add(1)).mul(grainMask.mul(0.06).oneMinus())
    this.metalnessNode = float(0.015)
    this.roughnessNode = mix(mix(float(0.7).sub(frost.mul(0.2)).sub(crystals.mul(0.3)), float(0.16), wetFilm.mul(0.6)), float(0.035), crackMask).clamp(0.02, 0.9)
    this.clearcoatNode = crackMask.mul(0.98).add(saltMask.mul(0.22)).add(crystals.mul(0.35)).add(wetFilm.mul(0.55)).clamp(0, 1)
    this.clearcoatRoughnessNode = mix(mix(float(0.42), float(0.16), wetFilm), float(0.018), crackMask).sub(crystals.mul(0.01)).clamp(0.01, 0.5)
    this.sheen = 0.1
    this.sheenColor.set(hsl.integer(86, 100, 96.4))
    this.sheenRoughness = 0.6
    this.normalNode = detailNormal(baseNormal, plateEdge.mul(0.0016).add(dome.mul(0.0007)).add(rim.mul(0.0009)).add(dryCrack.mul(0.0006)).add(crystals.mul(0.0011)).add(crystalGrain.mul(0.00003).mul(intimate)).add(ripple.mul(crackMask).mul(0.000025)), 1.4)
    this.aoNode = float(1).sub(brine.mul(0.16)).sub(dryCrack.mul(0.1)).sub(crystals.mul(0.2))
    const sun = environmentHighlight(environment, n, 0.025, {threshold: 1.15})
    const brineGlint = sun.mul(mix(color(hsl.integer(185, 99, 91.1)), color(hsl.integer(0, 0, 100)), waterShift)).mul(crackMask).mul(near.mul(0.35).add(0.8)).mul(0.8)
    const crystalGlint = environmentHighlight(environment, n, 0.015, {threshold: 1.05}).mul(crystals).mul(2.2)
    const sunSpot = view.negate().reflect(n).dot(vec3(0.45, 0.82, 0.35).normalize()).clamp()
    const sunFlare = color(hsl.integer(97, 100, 98.4)).mul(sunSpot.pow(720)).mul(crackMask.mul(0.9).add(0.1)).mul(1.8)
    const sunHalo = color(hsl.integer(90, 100, 93)).mul(sunSpot.pow(50)).mul(crackMask).mul(0.1)
    const saltSparkle = environmentHighlight(environment, n, 0.06, {threshold: 1.6}).mul(frost).mul(near.mul(0.5).add(0.25))
    this.emissiveNode = brineGlint.mul(near.mul(0.3).add(1)).add(crystalGlint).add(saltSparkle).add(sunFlare).add(sunHalo)
    this.envNode = proceduralEnvironment(panelSky({
      zenith: [0.1, 0.28, 0.68],
      horizon: [0.62, 0.8, 0.95],
      nadir: [0.5, 0.44, 0.34],
      glow: {
        color: [1, 0.9, 0.7],
        intensity: 0.4,
        width: 0.08,
      },
      panels: [{
        azimuth: 0.65,
        elevation: 0.98,
        halfWidth: 0.055,
        halfHeight: 0.055,
        color: [1, 0.96, 0.86],
        intensity: 24,
        softness: 0.035,
      }, {
        azimuth: -1.15,
        elevation: 0.42,
        halfWidth: 0.7,
        halfHeight: 0.12,
        color: [0.48, 0.7, 1],
        intensity: 0.75,
      }],
    }))
  }
}
