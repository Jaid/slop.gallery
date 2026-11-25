import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const columns = 36
const rows = 4
const stepsPerZiggurat = 6
/** Hopper crystal field on a periodic tube lattice: hollow stepped rectangular ziggurats where outer rims stand highest and inner terraces descend in crisp 90-degree ledges. */
function hopperField(cells: Node<'vec2'>) {
  const period = vec2(columns, rows)
  const cell = wrapCell(cells.floor(), period)
  const rnd = cellNoiseVec3(vec3(cell, 4.5))
  const local = cells.fract().sub(0.5)
// Slightly eccentric crystal aspect ratio and sub-ziggurat offset per cell.
  const q = local.sub(rnd.xy.sub(0.5).mul(0.14))
  const normCheb = q.x.abs().max(q.y.abs().mul(rnd.z.mul(0.25).add(0.88))).mul(2)
// Concentric hopper ridges: multiple stepped frames rising toward the perimeter and inner nested well.
  const ringCoord = normCheb.mul(stepsPerZiggurat)
  const stepIndex = ringCoord.floor()
  const stepFract = ringCoord.fract()
// Alternate raised hopper walls and sunken terrace floors.
  const wallProfile = stepFract.smoothstep(0.08, 0.18).mul(stepFract.smoothstep(0.82, 0.92).oneMinus())
  const outerElevation = normCheb.clamp(0, 1).mul(0.65).add(wallProfile.mul(0.35))
  const stepId = stepIndex.div(stepsPerZiggurat)
  const ledgeDistance = stepFract.sub(0.13).abs().min(stepFract.sub(0.87).abs())
  return {
    ledgeDistance,
    normCheb,
    outerElevation,
    q,
    rnd,
    stepFract,
    stepId,
    wallProfile,
  }
}
const displacedCrystal = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const cells = tubeCells(tube, columns, rows)
  const {outerElevation, rnd} = hopperField(cells)
  const cellHeight = rnd.x.mul(0.45).add(0.55)
  return position.add(normal.mul(outerElevation.mul(cellHeight).mul(0.0155)))
})
/** Synthetic Hopper Bismuth Crystal: terraced rectangular labyrinths with stepped oxide-film interference (gold -> magenta -> violet -> cyan -> emerald) and crisp 90° bevel reflections. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.35)
    this.name = knotData.id
    const tube = uv()
    const {facing, grazing, near, intimate} = viewerFrame()
    const cells = tubeCells(tube, columns, rows)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0005)
    const eps = 0.00012
    const du = displacedCrystal(tube.add(vec2(eps, 0))).sub(displacedCrystal(tube.sub(vec2(eps, 0))))
    const dv = displacedCrystal(tube.add(vec2(0, eps))).sub(displacedCrystal(tube.sub(vec2(0, eps))))
    const crystalNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedCrystal(tube)
// Parallax offset into the deep hollow hopper wells so nested crystal tiers slide past one another.
    const ray = tubeRay().mul(vec2(columns, rows))
    const top = hopperField(cells)
    const deep = hopperField(cells.sub(ray.mul(0.045)).mul(2))
    const ledgeLine = top.ledgeDistance.smoothstep(0, footprint.mul(1.8).add(0.035)).oneMinus()
    const deepLedge = deep.ledgeDistance.smoothstep(0, footprint.mul(3.2).add(0.055)).oneMinus().mul(near.mul(0.75).add(0.25))
// Micro-growth striations parallel to the rectangular crystal edges.
    const axisSelect = top.q.x.abs().greaterThan(top.q.y.abs())
    const striationCoord = mix(top.q.x, top.q.y, axisSelect.toFloat()).mul(TAU * 42)
    const striation = striationCoord.sin().mul(0.5).add(0.5).mul(footprint.smoothstep(0.012, 0.038).oneMinus())
// Full-spectrum Bi2O3 thin-film oxide interference: quantized per terrace step + viewing angle shift.
    const loopPhase = time.mul(Math.PI)
    const thermalWave = tube.x.mul(TAU * 2).sub(loopPhase).sin().mul(0.06)
    const oxideT = top.stepId.mul(0.55)
      .add(top.rnd.y.mul(0.65))
      .add(facing.mul(0.42))
      .add(deep.stepId.mul(0.18))
      .add(thermalWave)
    const bismuthPalette = cosinePalette(oxideT, [0.52, 0.52, 0.52], [0.48, 0.48, 0.48], [1, 1, 1], [0, 0.33, 0.67]).clamp(0.04, 1)
    const rawSilverBismuth = color(hsl.integer(248, 45, 96))
// Freshly cleaved terrace edges gleam silver-white; terrace flats carry full rainbow oxide interference.
    const baseMetal = mix(bismuthPalette, rawSilverBismuth, ledgeLine.mul(0.55))
    const shadowedPit = top.outerElevation.smoothstep(0.12, 0.85).mul(0.66).add(0.34)
    this.colorNode = baseMetal.mul(shadowedPit).mul(striation.mul(0.18).add(0.88))
    this.metalness = 1
    this.roughnessNode = float(0.065)
      .add(top.wallProfile.oneMinus().mul(0.075))
      .add(striation.mul(0.045))
      .sub(ledgeLine.mul(0.035))
      .clamp(0.025, 0.2)
    this.iridescence = 0.85
    this.iridescenceIOR = 1.88
    this.iridescenceThicknessNode = top.stepId.mul(340).add(top.rnd.z.mul(160)).add(facing.mul(220)).add(180)
// Orthogonal brushing along the rectangular crystal ledges.
    const anisoDir = mix(vec2(1, 0), vec2(0, 1), axisSelect.toFloat())
    this.anisotropyNode = anisoDir.mul(0.76)
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.03
    const fineHeight = top.wallProfile.mul(0.0028)
      .add(deep.wallProfile.mul(0.0012).mul(top.wallProfile.oneMinus()))
      .add(striation.mul(0.00035))
    this.normalNode = detailNormal(crystalNormal, fineHeight, 0.95)
    this.aoNode = shadowedPit
    const studio = panelSky({
      zenith: [0.06, 0.08, 0.14],
      horizon: [0.2, 0.2, 0.24],
      nadir: [0.02, 0.02, 0.04],
      glow: {
        color: [0.95, 0.75, 0.35],
        intensity: 0.75,
        width: 0.09,
      },
      panels: [{
        azimuth: 0.6,
        elevation: 0.58,
        halfWidth: 0.36,
        halfHeight: 0.22,
        color: [1, 0.94, 0.82],
        intensity: 8.5,
        panes: [3, 2],
      }, {
        azimuth: -1.05,
        elevation: 0.42,
        halfWidth: 0.045,
        halfHeight: 0.68,
        color: [0.45, 0.95, 1],
        intensity: 11.5,
      }, {
        azimuth: 2.45,
        elevation: 0.48,
        halfWidth: 0.32,
        halfHeight: 0.05,
        color: [1, 0.35, 0.72],
        intensity: 9.5,
      }, {
        azimuth: -2.25,
        elevation: 0.18,
        halfWidth: 0.46,
        halfHeight: 0.045,
        color: [0.4, 1, 0.68],
        intensity: 7.5,
      }],
    })
    this.envNode = proceduralEnvironment(studio)
// Diffraction glints along the 90-degree crystal step corners and sub-terrace edges.
    const cornerGlint = ledgeLine.add(deepLedge.mul(0.55)).mul(grazing.mul(0.75).add(0.25))
    this.emissiveNode = bismuthPalette.mul(cornerGlint).mul(intimate.mul(0.45).add(0.4))
      .add(color(hsl.integer(0, 0, 100)).mul(ledgeLine.pow(2)).mul(grazing.pow(2.5)).mul(0.32))
  }
}
