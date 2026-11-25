import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, bitangentView, color, float, mix, mx_noise_float, select, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const columns = 20
const rows = 4
/** Overlapping Seraphim / Peacock plumage imbrication along the knot tube. Evaluates a neighborhood of staggered candidate feathers using a smooth depth-sorted height field (`max()` with smooth margin). Every feather's proximal base and quill root is tucked underneath the preceding column's distal feather tip! */
function plumageField(cells: Node<'vec2'>) {
  const period = vec2(columns, rows)
  const baseCell = cells.floor()
  const local = cells.fract()
// Candidates ordered from smallest ox (front-most overlapping tip reaching into current cell) to largest ox (underneath).
// Every odd column is staggered by half a row (0.5 in y).
  const candidates = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]] as const
  let topZ: Node<'float'> = float(-10)
  let secondZ: Node<'float'> = float(-10)
  let chosenQ: Node<'vec2'> = vec2(0)
  let chosenCell: Node<'vec2'> = baseCell
  let chosenEdgeDist: Node<'float'> = float(0)
  for (const [ox, oy] of candidates) {
    const candCol = baseCell.x.add(ox)
    const colParity = candCol.mod(2).add(2).mod(2)
    const staggerY = colParity.mul(0.5)
    const candRow = baseCell.y.add(oy)
    const center = vec2(float(ox).add(0.45), float(oy).add(staggerY).add(0.5))
    const q = local.sub(center)
// Long imbricated feather: extends from q.x = -0.95 (base tucked deep under ox = -1 feather) to q.x = +0.85 (distal tip).
    const uFeather = q.x.add(0.05).div(0.92)
    const widthProfile = uFeather.clamp(-0.98, 1).mul(0.62).cos().mul(0.88).max(0.34)
    const vNorm = q.y.div(widthProfile)
    const normDist = uFeather.pow(2).add(vNorm.pow(2)).sqrt()
    const edgeDist = float(1).sub(normDist)
// Shingle Z-priority: distal tips (smaller ox, larger q.x) sit ABOVE proximal bases of the next feather in +u!
    const zHeight = float(-ox).mul(0.85).add(edgeDist.clamp(0, 1).smoothstep(0, 0.22).mul(0.65)).sub(normDist.max(1).sub(1).mul(4))
    const isBetter = edgeDist.greaterThan(0).and(zHeight.greaterThan(topZ))
    const isSecond = edgeDist.greaterThan(0).and(isBetter.not()).and(zHeight.greaterThan(secondZ))
    secondZ = select(isBetter, topZ, select(isSecond, zHeight, secondZ))
    topZ = select(isBetter, zHeight, topZ)
    chosenQ = select(isBetter, q, chosenQ)
    chosenCell = select(isBetter, vec2(candCol, candRow), chosenCell)
    chosenEdgeDist = select(isBetter, edgeDist, chosenEdgeDist)
  }
  const wrapped = wrapCell(chosenCell, period)
  const rnd = cellNoiseVec3(vec3(wrapped, 19.3))
  const rnd2 = cellNoiseVec3(vec3(wrapped.add(vec2(41.2, 17.9)), 53.1))
// Depth gap between the winning feather lip and the feather beneath it: zero right at the overlap seam!
  const overlapGap = topZ.sub(secondZ).max(0)
  const seamMask = overlapGap.smoothstep(0, 0.22)
  const rimBevel = overlapGap.smoothstep(0, 0.2)
  const rimLip = overlapGap.smoothstep(0.015, 0.065).mul(overlapGap.smoothstep(0.065, 0.19).oneMinus())
// Ocellus ("Seraph's Eye") nestled in the exposed distal crown of the feather vane, scaled isotropically in world-length units!
  const eyeCenter = vec2(0.2, 0)
  const eyeVec = chosenQ.sub(eyeCenter).mul(vec2(1.42, 1.06))
  const eyeR = eyeVec.length()
  const eyeAngle = atan(eyeVec.y, eyeVec.x.add(1e-6))
  const eyeSafe = overlapGap.smoothstep(0.06, 0.22)
  const limbalRing = eyeR.sub(0.38).abs().div(0.042).pow(2).negate().exp().mul(eyeSafe)
  const aureole = eyeR.smoothstep(0.36, 0.42).mul(eyeR.smoothstep(0.51, 0.59).oneMinus()).mul(eyeSafe)
// High hemispherical cabochon gemstone dome over the Seraph's Eye.
  const corneaNorm = eyeR.div(0.41).clamp(0, 1)
  const corneaMask = float(1).sub(corneaNorm).smoothstep(0, 0.16).mul(eyeSafe)
  const corneaDome = float(1).sub(corneaNorm.pow(2)).max(0).sqrt().mul(corneaMask)
// Central 24k golden quill shaft (rachis): emerges inside the feather vane and terminates into the golden calamus setting at the base of the Seraph's Eye,
// so the quill NEVER cuts across the cabochon eye pupil!
  const tipProgress = chosenQ.x.add(0.85).div(1.7).clamp(0, 1)
  const rootFade = tipProgress.smoothstep(0.28, 0.42)
  const beforeEyeFade = eyeR.smoothstep(0.35, 0.44)
  const tipTaper = tipProgress.smoothstep(0.52, 0.68).oneMinus()
  const quillSafeZone = overlapGap.smoothstep(0.12, 0.3)
  const quillEnvelope = rootFade.mul(tipTaper).mul(beforeEyeFade).mul(quillSafeZone)
  const quillHalfWidth = float(0.052).mul(quillEnvelope.pow(0.6)).max(0.002)
  const quillSigned = chosenQ.y.div(quillHalfWidth)
  const quillDist = quillSigned.abs()
  const quillMask = quillDist.smoothstep(0.58, 1.02).oneMinus().mul(quillEnvelope)
  const quillDome = quillDist.clamp(0, 1).pow(2).oneMinus().pow(1.35).mul(quillMask)
// Gentle, rounded shingle lip and contact shadow cast by the overlapping feather margin onto the feather tucked beneath it!
  const shingleVault = rimBevel.mul(tipProgress.mul(0.45).add(chosenEdgeDist.clamp(0, 1).mul(0.55))).add(rimLip.mul(0.16))
  const underLipDropShadow = overlapGap.smoothstep(0, 0.26).mul(0.58).add(0.42)
  return {
    aureole,
    corneaDome,
    corneaMask,
    edgeDist: chosenEdgeDist,
    eyeAngle,
    eyeR,
    eyeVec,
    limbalRing,
    overlapGap,
    q: chosenQ,
    quillDist,
    quillDome,
    quillMask,
    quillSigned,
    rimLip,
    rnd,
    rnd2,
    seamMask,
    shingleVault,
    tipProgress,
    underLipDropShadow,
  }
}
/** Morpho Rhetenor & Seraphim Ocellus Structural Iridescent Plumage: Analytic tangent-space cabochon normal domes bow specular highlights over every Seraph's Eye, while 24k golden quills anchor into the eye's limbal bezel and backscattered sapphire-violet iridescence illuminates the shadow side. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const tube = uv()
    const {view, facing, grazing, near} = viewerFrame()
    const cells = tubeCells(tube, columns, rows)
// Use ONLY the unwrapped `cells` footprint for anti-aliasing so cell borders never suffer derivative spikes!
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0004)
    const ray = tubeRay().mul(vec2(columns, rows))
    const top = plumageField(cells)
// Parallax-shifted shingle evaluation so overlapping feather rims visibly slide over the recessed feather underneath and cast a soft contact shadow.
    const underSample = plumageField(cells.add(ray.mul(0.02)))
    const directionalShadow = underSample.overlapGap.smoothstep(0, 0.24).mul(0.58).add(0.42)
    const deepCavityAO = top.underLipDropShadow.min(directionalShadow)
// Silky organic feather barbs (1D diagonal filaments ONLY—no orthogonal grid crosshatch that could cause checkerboard moiré!).
// Strict Nyquist filter: fade out normal perturbation well before the Nyquist limit and convert unresolved barbs into roughness!
    const smoothAbsY = top.q.y.pow(2).add(0.004).sqrt()
    const barbFreq = 14
    const filterWidth = footprint.mul(barbFreq)
    const barbResolved = filterWidth.smoothstep(0.05, 0.22).oneMinus().mul(top.seamMask)
    const barbPhase = top.q.x.mul(barbFreq).sub(smoothAbsY.mul(barbFreq * 0.72)).add(mx_noise_float(vec3(cells.mul(2.5), 1.7)).mul(0.18))
    const barbSilk = barbPhase.mul(TAU).cos().mul(barbResolved).mul(0.5).add(0.5)
// Multi-depth cabochon gem refraction inside the Seraph's Eye:
    const irisVec = top.eyeVec.sub(ray.mul(top.corneaDome.mul(0.12)))
    const irisR = irisVec.length()
    const irisAngle = atan(irisVec.y, irisVec.x.add(1e-6))
    const pupilVec = top.eyeVec.sub(ray.mul(top.corneaDome.mul(0.22)))
    const pupilR = pupilVec.length()
    const causticVec = top.eyeVec.add(ray.mul(top.corneaDome.mul(0.14)))
    const innerCaustic = causticVec.sub(vec2(-0.05, 0.04)).length().smoothstep(0.02, 0.14).oneMinus().mul(top.corneaDome)
    const pupil = pupilR.smoothstep(0.12, 0.17).oneMinus().mul(top.seamMask)
    const iris = irisR.smoothstep(0.13, 0.18).mul(irisR.smoothstep(0.35, 0.41).oneMinus()).mul(top.seamMask)
    const irisRadialFade = irisR.smoothstep(0.14, 0.24).mul(footprint.mul(12).smoothstep(0.08, 0.32).oneMinus())
    const irisFilaments = irisAngle.mul(16).sin().mul(irisRadialFade).mul(0.5).add(0.5)
// Smooth barb tangent direction for fibrous Kajiya-Kay anisotropic reflection across the feather vanes.
    const smoothSide = top.q.y.div(smoothAbsY)
    const barbDir3D = vec3(0.78, smoothSide.mul(0.62), 0.15).normalize()
    const kajiyaSin = float(1).sub(barbDir3D.dot(view).pow(2)).max(0.01).sqrt()
    const kajiyaSheen = kajiyaSin.pow(18)
// Physical thin-film interference path difference across the Morpho chitin micro-lamellae (n = 1.56).
    const featherTilt = top.rnd.xy.sub(0.5).mul(0.65).mul(top.seamMask)
    const localCos = facing.add(featherTilt.x.mul(view.x)).add(featherTilt.y.mul(view.y)).add(smoothSide.mul(view.y).mul(0.2).mul(top.seamMask)).clamp(0, 1)
    const loopPhase = tube.x.mul(TAU * 2).sub(time.mul(Math.PI)).sin().mul(0.05)
    const cosInternal = float(1).sub(float(1).sub(localCos.pow(2)).div(1.56 * 1.56)).max(0.05).sqrt()
    const opticalPath = cosInternal.mul(1.85).add(top.rnd.x.mul(0.28).mul(top.seamMask)).add(barbSilk.mul(0.04)).add(loopPhase)
// Morpho rhetenor structural interference: normal incidence flashes blinding electric cyan-azure; oblique angles shift into deep royal cobalt and ultraviolet!
    const morphoSpectrum = cosinePalette(opticalPath, [0.14, 0.42, 0.88], [0.36, 0.46, 0.16], [1, 1, 0.85], [0.54, 0.16, 0]).clamp(0.02, 1)
    const morphoVane = morphoSpectrum.mul(kajiyaSheen.mul(0.74).add(0.36))
// Ocellus ("Seraph's Eye") cabochon gem interior:
    const abyssPupil = mix(color(hsl.integer(295, 73, 2.5)), color(hsl.integer(287, 92, 11)), localCos.oneMinus().pow(1.8)).add(color(hsl.integer(200, 100, 89)).mul(innerCaustic.pow(2).mul(0.95)))
    const irisPhase = cosInternal.mul(1.65).add(irisR.mul(1.2)).add(irisFilaments.mul(0.14)).add(top.rnd.y.mul(0.25)).add(loopPhase)
    const emeraldIris = cosinePalette(irisPhase, [0.1, 0.68, 0.56], [0.26, 0.34, 0.38], [1, 1, 1], [0.36, 0.04, 0.64]).clamp(0.04, 1)
      .mul(irisFilaments.mul(0.35).add(0.8))
      .add(color(hsl.integer(176, 99, 93.2)).mul(innerCaustic.mul(0.5)))
    const copperAureole = mix(color(hsl.integer(43, 93, 43.5)), color(hsl.integer(87, 100, 87)), localCos.mul(0.55).add(barbSilk.mul(0.45)))
// Bold sculpted 24k golden rachis (quill shaft) & raised limbal bezel ring framing the cabochon eye.
    const goldMask = top.quillMask.max(top.limbalRing.smoothstep(0.28, 0.7)).clamp()
    const quillSeamAO = top.quillDist.sub(1.05).abs().smoothstep(0, 0.28).mul(0.28).add(0.72)
    const quillNormalHighlight = float(1).sub(top.quillSigned.clamp(-1, 1).pow(2)).max(0).sqrt()
    const filigreeGold = mix(color(hsl.integer(73, 88, 62)), color(hsl.integer(95, 100, 90.2)), quillNormalHighlight.mul(0.68).add(facing.mul(0.32)))
    const withAureole = mix(morphoVane, copperAureole, top.aureole)
    const withIris = mix(withAureole, emeraldIris, iris)
    const withPupil = mix(withIris, abyssPupil, pupil)
    const vaneColor = withPupil.mul(deepCavityAO).mul(quillSeamAO).mul(barbSilk.mul(0.18).add(0.86)).add(color(hsl.integer(227, 99, 74.3)).mul(top.rimLip).mul(0.2))
    this.colorNode = mix(vaneColor, filigreeGold.mul(top.underLipDropShadow.mul(0.35).add(0.65)), goldMask)
// Dry, fibrous structural reflection on the Morpho vanes, pure 24k metallic gold on the quills, and glossy refractive cabochon dome ONLY over the Seraph's Eye!
    const isCabochon = top.corneaMask
    this.metalnessNode = mix(mix(float(0.76), float(0.04), isCabochon), float(1), goldMask)
    const unresolvedRoughnessBoost = barbResolved.oneMinus().mul(0.12)
    this.roughnessNode = mix(mix(float(0.26).add(barbSilk.oneMinus().mul(0.06)).add(unresolvedRoughnessBoost), float(0.012), isCabochon), float(0.18), goldMask)
// Strong velvety keratin sheen across the feather barbules.
    this.sheenNode = mix(color(hsl.integer(291, 100, 46.5)), color(hsl.integer(209, 100, 82)), localCos).mul(isCabochon.oneMinus()).mul(goldMask.oneMinus()).mul(0.88)
    this.sheenRoughness = 0.28
// Thin-film iridescence on the feather vanes and iris, completely disabled on the 24k golden quills.
    this.iridescenceNode = goldMask.oneMinus().mul(pupil.oneMinus().mul(0.75).add(0.2))
    this.iridescenceIOR = 1.76
    this.iridescenceThicknessNode = cosInternal.mul(360).add(irisR.mul(160)).add(top.rnd.z.mul(120)).add(210)
// Extreme directional anisotropy (0.96) oriented perpendicular to the feather barb micro-ribs!
    const barbAngle = smoothSide.mul(0.62)
    const barbTangent = vec2(barbAngle.cos(), barbAngle.sin())
    this.anisotropyNode = mix(barbTangent.mul(0.96).mul(top.seamMask), vec2(1, 0).mul(0.72), goldMask).mul(isCabochon.oneMinus())
// Clearcoat is 0.0 on the feather vanes and 1.0 ONLY on the cabochon gem eye and golden quill!
    this.clearcoatNode = isCabochon.max(goldMask.mul(0.5))
    this.clearcoatRoughness = 0.012
// Bevel normal deflection is attenuated at extreme grazing angles (`facing.smoothstep(0.05, 0.35)`) so `dot(N, V)` never flips negative into black crease artifacts!
    const grazingDamp = facing.smoothstep(0.05, 0.35).mul(0.75).add(0.25)
    const compositeHeight = top.shingleVault.mul(0.0046).mul(grazingDamp)
      .add(top.quillDome.mul(0.0085))
      .add(barbSilk.mul(0.00024).mul(goldMask.oneMinus()).mul(isCabochon.oneMinus()))
    const baseSculptedNormal = proceduralNormal(compositeHeight, 1)
// Explicit analytic tangent-space hemispherical normal deflection (`cabochonTilt`) for the Seraph's Eye cabochon lens!
// Deflects the normal up to 35 degrees radially outward across the eye so specular highlights dramatically bow and focus into a tight gemstone hotspot!
    const T = tangentView.normalize()
    const B = vec3(bitangentView as unknown as Node<'vec3'>).normalize()
    const lensOffset = top.eyeVec.div(0.41)
    const cabochonTilt = T.mul(lensOffset.x).add(B.mul(lensOffset.y)).mul(isCabochon).mul(0.72).mul(grazingDamp)
    const finalNormal = baseSculptedNormal.add(cabochonTilt).normalize()
    this.normalNode = finalNormal
    this.clearcoatNormalNode = finalNormal
    this.aoNode = deepCavityAO.mul(quillSeamAO).max(goldMask.mul(0.88))
// Celestial sanctuary lighting: soft, wide seraphic light domes so reflections glide silkily across the anisotropic feather barbs and bow around the cabochon lenses.
    const sanctuary = panelSky({
      zenith: [0.015, 0.03, 0.095],
      horizon: [0.04, 0.05, 0.1],
      nadir: [0.008, 0.006, 0.02],
      glow: {
        color: [0.32, 0.64, 1],
        intensity: 0.45,
        width: 0.08,
      },
      panels: [{
        azimuth: 0.5,
        elevation: 0.55,
        halfWidth: 0.34,
        halfHeight: 0.24,
        color: [1, 0.93, 0.78],
        intensity: 6.8,
        softness: 0.24,
      }, {
        azimuth: -1.1,
        elevation: 0.45,
        halfWidth: 0.12,
        halfHeight: 0.58,
        color: [0.32, 0.82, 1],
        intensity: 7.6,
        softness: 0.22,
      }, {
        azimuth: 2.3,
        elevation: 0.4,
        halfWidth: 0.36,
        halfHeight: 0.1,
        color: [1, 0.76, 0.36],
        intensity: 6.2,
        softness: 0.22,
      }, {
        azimuth: -2.35,
        elevation: 0.24,
        halfWidth: 0.38,
        halfHeight: 0.1,
        color: [0.68, 0.32, 1],
        intensity: 5.8,
        softness: 0.22,
      }],
    })
    this.envNode = proceduralEnvironment(sanctuary)
// Structural Bragg diffraction flash + saturated sapphire/ultraviolet backscattering floor so unlit shadow loops never drop to dead muddy black!
    const featherFlash = top.rnd2.x.sub(localCos).abs().smoothstep(0, 0.22).oneMinus().mul(top.seamMask)
    const vaneFire = mix(color(hsl.integer(217, 100, 78)), color(hsl.integer(270, 100, 48.4)), localCos.oneMinus()).mul(featherFlash.pow(1.6)).mul(kajiyaSheen).mul(goldMask.oneMinus()).mul(isCabochon.oneMinus()).mul(deepCavityAO).mul(0.58)
    const shadowBackscatter = mix(color(hsl.integer(268, 92, 21.4)), color(hsl.integer(294, 89, 22)), top.tipProgress).mul(goldMask.oneMinus()).mul(pupil.oneMinus()).mul(deepCavityAO).mul(0.24)
    const irisFire = emeraldIris.mul(iris.add(innerCaustic.mul(0.65))).mul(near.mul(0.45).add(0.45))
    const quillGoldGlow = color(hsl.integer(85, 100, 83.8)).mul(goldMask).mul(quillNormalHighlight.mul(0.55).add(grazing.pow(1.8).mul(0.55))).mul(0.54)
    const violetGrazing = mix(color(hsl.integer(286, 100, 44.7)), color(hsl.integer(220, 100, 77)), top.tipProgress).mul(grazing.pow(3)).mul(goldMask.oneMinus()).mul(deepCavityAO).mul(0.42)
    this.emissiveNode = vaneFire.add(shadowBackscatter).add(irisFire).add(quillGoldGlow).add(violetGrazing)
  }
}
