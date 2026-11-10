import type {Texture} from 'three/webgpu'

import {color, float, mix, mx_fractal_noise_float, normalLocal, saturation, time, transformNormalToView, uv, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {environmentHighlight} from '../../candidates/deepseek/lib/environment.ts'
import {createInterferenceLut, interferenceColor} from '../../candidates/deepseek/lib/interference.ts'
import {knotCircumference, knotLength} from '../../candidates/deepseek/lib/tubeMetric.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const signedWrap = (value: ReturnType<typeof uv>['x'], center: number, scale: number) => value.sub(center).add(0.5).fract().sub(0.5).mul(scale)
/**
 * A block of clear epoxy frozen under load and viewed between crossed polarizers. A constellation of
 * buried pressure points and a slow tectonic background build a real stress tensor; retardance is integrated
 * through the CIE observer, so the fringes follow the Michel-Lévy sequence. The path through the
 * resin lengthens as the eye grazes it, which is why the colors drift as you walk.
 */
export default class extends KnotMaterial {
  private readonly lut = createInterferenceLut()
  constructor(environment: Texture) {
    super(environment, 1.18)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const n = normalLocal.normalize()
    const baseNormal = transformNormalToView(n).normalize()
    const anchor = (along: number, around: number, strength: number, softness: number) => {
      const du = signedWrap(tube.x, along, knotLength)
      const dv = signedWrap(tube.y, around, knotCircumference)
      return float(strength).div(du.pow2().add(dv.pow2()).add(softness))
    }
// Loads pressing inward at four places, plus the residual stress of the pour.
    const tectonic = mx_fractal_noise_float(p.mul(2.35).add(vec3(7.1, -3.8, 2.4)), 3, 2.02, 0.52)
    const stress = anchor(0.12, 0.3, 1.05, 0.0035)
      .add(anchor(0.5, 0.66, 1.35, 0.0028))
      .add(anchor(0.79, 0.24, 0.8, 0.0045))
      .add(anchor(0.63, 0.83, 0.62, 0.005))
      .add(anchor(0.31, 0.12, 0.72, 0.0042))
      .add(anchor(0.91, 0.52, 0.9, 0.0038))
      .add(anchor(0.2, 0.78, 0.58, 0.0055))
      .add(tectonic.mul(5).add(10)).add(tube.x.mul(TAU * 2).add(tectonic.mul(1.8)).sin().mul(45).add(60))
    const breathing = time.mul(0.32).add(tectonic.mul(2.7)).sin().mul(0.045).add(1)
// Snell's law lengthens the optical path toward the silhouette; the birefringence is integrated along it.
    const incidence = n.dot(view).abs().clamp(0.03, 1)
    const cosRefracted = float(1).sub(incidence.pow2().oneMinus().div(1.46 * 1.46)).max(0.05).sqrt()
    const pathLength = float(1).div(cosRefracted)
    const orientation = view.dot(vec3(0.72, 0.31, -0.62).normalize()).abs().mul(0.15).add(0.85)
    const microStress = mx_fractal_noise_float(p.mul(11.5).add(37.1), 3, 2.1, 0.5).mul(22).mul(intimate.mul(0.8).add(0.2))
    const retardance = stress.add(microStress).mul(5.5).mul(pathLength).mul(orientation).mul(breathing).mul(near.mul(0.28).add(0.72))
    const fringe = saturation(interferenceColor(this.lut, retardance), 1.5)
    const order = retardance.div(550)
    const footprint = order.fwidth().max(0.0001)
    const resolved = footprint.smoothstep(0.2, 0.85).oneMinus()
    const pearl = mix(color('#504b42'), color('#3c4354'), tectonic.mul(0.5).add(0.5))
    const distanceMix = near.mul(0.35).add(0.6)
    const fringeColor = mix(pearl, fringe, resolved.mul(distanceMix))
    const fringeEnergy = resolved.mul(near.mul(0.25).add(0.7)).add(0.05)
// The resin itself stays nearly black: the color is light that has survived the second polarizer.
    const mottle = mx_fractal_noise_float(p.mul(2.9).add(19.1), 3, 2.03, 0.5).mul(0.5).add(0.5)
    const resin = mix(color('#03050a'), mix(color('#0a111d'), color('#160b2a'), grazing.mul(0.7)), mottle.mul(0.65).add(facing.mul(0.35)))
// Fine frozen cracks radiate from the load points, almost invisible until the visitor is close.
    const crackWarp = mx_fractal_noise_float(p.mul(6.2).add(31.4), 2, 2.1, 0.5)
    const crackPhase = p.dot(vec3(28, 17, 23)).add(crackWarp.mul(9)).sin().abs()
    const crack = crackPhase.smoothstep(0, 0.04).oneMinus().mul(intimate).mul(0.28)
    const crackFootprint = p.dot(vec3(28, 17, 23)).fwidth().smoothstep(0.2, 1.1).oneMinus()
    const microCracks = crack.mul(crackFootprint)
    const fracPhase = p.dot(vec3(37, 19, 29)).add(crackWarp.mul(13)).sin().abs()
    const fracLine = fracPhase.smoothstep(0, 0.032).oneMinus().mul(fracPhase.fwidth().smoothstep(0.2, 1.2).oneMinus()).mul(intimate).mul(0.3)
    const microFracture = microCracks.add(fracLine).clamp()
    this.colorNode = resin.mul(microFracture.mul(0.55).oneMinus()).add(color('#9fb8d8').mul(fracLine).mul(0.12))
    this.metalness = 0
    this.roughnessNode = float(0.035).add(microFracture.mul(0.24)).clamp(0.02, 0.3)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescenceNode = grazing.mul(0.08)
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = float(320).add(tectonic.mul(120))
    this.ior = 1.46
    this.specularIntensity = 0.4
    this.normalNode = detailNormal(baseNormal, microFracture.mul(0.00016).add(tectonic.mul(0.00008)), 0.65)
    const glassGlint = environmentHighlight(environment, n, 0.025, {threshold: 1.35})
    const fractureSpot = view.negate().reflect(n).dot(vec3(0.25, 0.86, 0.45).normalize()).clamp().pow(420)
    const fractureFlare = color('#eaf3ff').mul(fractureSpot).mul(microFracture).mul(0.55)
    const stressHalo = color('#5b46ff').mul(stress.smoothstep(120, 700)).mul(0.035).mul(near.mul(0.4).add(0.6))
    const pearlGlow = pearl.mul(fringeEnergy).mul(0.035)
    this.emissiveNode = fringeColor.mul(fringeEnergy).mul(0.36).add(stressHalo).add(pearlGlow).add(glassGlint.mul(0.05)).add(color('#9fb8e8').mul(grazing.pow(4)).mul(0.05)).add(color('#dceaff').mul(fracLine).mul(0.28)).add(fractureFlare)
  }
  override dispose() {
    this.lut.dispose()
    super.dispose()
  }
}
