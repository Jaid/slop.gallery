import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {tubeMetric, tubeTurns} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const chambers = 54
const flutes = 12
const shellShape = (tube: Node<'vec2'>) => {
  const turns = tubeTurns(tube)
  const ribPhase = tube.x.mul(TAU * chambers).add(turns.mul(TAU).sin().mul(0.55))
  const ribArch = ribPhase.cos().mul(0.5).add(0.5).pow(0.68)
  const sutureCrease = ribPhase.cos().add(1).smoothstep(0, 0.22)
  const fluteWave = turns.mul(TAU * flutes).cos()
  const spiralCord = turns.mul(TAU * flutes * 2).add(ribPhase.sin().mul(0.25)).cos()
  const relief = ribArch.mul(0.0115).mul(sutureCrease.mul(0.55).add(0.45)).add(fluteWave.mul(0.0024)).add(spiralCord.mul(0.0008))
  return {
    fluteWave,
    relief,
    ribArch,
    ribPhase,
    sutureCrease,
    turns,
  }
}
const displacedShell = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  return position.add(normal.mul(shellShape(tube).relief))
})
/** Calcified cephalopod shell with sculpted costae, flame-patterned periostracum ridges, Bragg-stack aragonite nacre platelets and parallax septal chambers glowing from within. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.88)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const metric = tubeMetric(tube)
    const {ribArch, sutureCrease, fluteWave, turns} = shellShape(tube)
    const eps = 0.00012
    const du = displacedShell(tube.add(vec2(eps, 0))).sub(displacedShell(tube.sub(vec2(eps, 0))))
    const dv = displacedShell(tube.add(vec2(0, eps))).sub(displacedShell(tube.sub(vec2(0, eps))))
    const shellNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedShell(tube)
// Growth striae and aragonite terrace micro-steps, derivative-filtered against aliasing.
    const striae = opticalBands(tube.x.mul(TAU * chambers * 8).add(fluteWave.mul(1.8)))
    const terraceField = mx_noise_float(vec3(metric.x.mul(14), metric.y.mul(22), ribArch.mul(3)))
    const terraceRings = opticalLine(terraceField.mul(8).fract().sub(0.5), 0.055).mul(near.mul(0.75).add(0.25))
// Tangent-space parallax looks through the translucent aragonite wall into the cameral chambers and siphuncle.
    const ray = tubeRay()
    const innerU = tube.x.sub(ray.x.mul(0.22))
    const innerV = turns.sub(ray.y.mul(0.18))
    const deepU = tube.x.sub(ray.x.mul(0.48))
    const deepV = turns.sub(ray.y.mul(0.38))
    const septumField = innerU.mul(TAU * chambers).add(innerV.mul(TAU * 2).sin().mul(0.45)).sin()
    const septumWall = opticalLine(septumField, 0.065)
    const deepSeptum = opticalLine(deepU.mul(TAU * chambers).add(deepV.mul(TAU * 2).cos().mul(0.35)).sin(), 0.085)
    const siphuncle = innerV.mul(TAU).cos().smoothstep(0.65, 0.98)
// Bragg-stack thin-film optical path difference: shifts continuously with viewing angle and terrace contour.
    const opticalPath = facing.mul(5.2).add(ribArch.mul(2.3)).add(terraceField.mul(2.1)).add(view.y.mul(1.4)).add(time.mul(Math.PI * 0.5))
    const nacreSpectrum = spectralColor(opticalPath)
    const roseGold = mix(color(hsl.integer(355, 100, 64.6)), color(hsl.integer(71, 100, 80.4)), nacreSpectrum.x)
    const peacockEmerald = mix(color(hsl.integer(171, 99.2, 80)), color(hsl.integer(262.4, 100, 55)), nacreSpectrum.z)
    const nacreBody = mix(roseGold, peacockEmerald, grazing.smoothstep(0.08, 0.78))
    const pearlBase = mix(color(hsl.integer(260, 34, 17)), nacreBody, ribArch.mul(0.65).add(0.25))
// Chestnut-terracotta periostracum tiger stripes hug the outer rib crests while sutures expose pure mother-of-pearl.
    const flameNoise = mx_noise_float(vec3(metric.x.mul(7.5), metric.y.mul(11), 1.7))
    const flamePattern = tube.x.mul(TAU * 19).add(turns.mul(TAU * 3).sin().mul(2.1)).add(flameNoise.mul(2.4)).cos()
    const periostracumMask = ribArch.smoothstep(0.54, 0.86).mul(flamePattern.smoothstep(-0.1, 0.42)).mul(0.78)
    const periostracumColor = mix(color(hsl.integer(36, 70, 9)), color(hsl.integer(36, 91, 39)), striae.mul(0.6).add(ribArch.mul(0.4)))
// Fine saline dew beads on the shell exterior catch studio highlights at close inspection.
    const dew = beads(p.mul(36), 5.2)
    const dewHighlight = glints(shellNormal, 90).mul(dew.mask).mul(intimate)
    const baseAlbedo = mix(pearlBase, periostracumColor, periostracumMask)
    const sutureDarkening = mix(color(hsl.integer(247, 39, 8)), baseAlbedo, sutureCrease.mul(0.8).add(0.2))
    this.colorNode = mix(sutureDarkening, color(hsl.integer(207, 100, 93)), terraceRings.mul(0.32).add(dew.mask.mul(0.18)))
    this.metalnessNode = periostracumMask.oneMinus().mul(0.38)
    this.roughnessNode = mix(float(0.11), float(0.34), periostracumMask)
      .add(striae.oneMinus().mul(0.04))
      .sub(dew.mask.mul(0.06))
      .clamp(0.04, 0.42)
    this.ior = 1.58
    this.iridescenceNode = periostracumMask.oneMinus().mul(0.95).add(0.05)
    this.iridescenceIOR = 1.72
    this.iridescenceThicknessNode = facing.mul(290).add(ribArch.mul(165)).add(terraceField.mul(95)).add(230)
    this.sheenNode = mix(color(hsl.integer(347, 99, 71)), color(hsl.integer(172, 99, 88.1)), grazing).mul(0.55)
    this.sheenRoughness = 0.24
    this.anisotropyNode = periostracumMask.oneMinus().mul(0.64)
    this.anisotropyRotation = 0
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.025), float(0.1), periostracumMask).sub(dew.mask.mul(0.018)).max(0.01)
    const microHeight = striae.mul(0.00048).add(terraceRings.mul(0.00038)).add(dew.cap.mul(dew.mask).mul(0.0012))
    this.normalNode = detailNormal(shellNormal, microHeight, 0.92)
    this.aoNode = sutureCrease.mul(0.52).add(0.48)
// Travelling abyssal bioluminescent pulse along the internal siphuncle and septal walls.
    const pulseWave = innerU.mul(TAU * 3).sub(time.mul(Math.PI)).sin().mul(0.5).add(0.5).pow(2.5)
    const chamberGlow = septumWall.mul(0.9).add(deepSeptum.mul(0.5)).add(siphuncle.mul(0.75))
    const internalLight = mix(color(hsl.integer(214, 100, 67)), color(hsl.integer(166, 100, 87.4)), pulseWave).mul(chamberGlow).mul(periostracumMask.oneMinus()).mul(near.mul(0.65).add(0.35))
    const nacreRim = mix(color(hsl.integer(354, 100, 64.5)), color(hsl.integer(173, 95, 84)), facing).mul(grazing.pow(2.4)).mul(0.42)
    this.emissiveNode = internalLight.mul(0.85)
      .add(nacreRim)
      .add(nacreBody.mul(terraceRings).mul(0.35))
      .add(color(hsl.integer(0, 0, 100)).mul(dewHighlight).mul(0.95))
  }
}
