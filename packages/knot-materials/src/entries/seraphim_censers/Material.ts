import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, Fn, mix, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'
import {DoubleSide, MeshPhysicalNodeMaterial} from 'three/webgpu'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const baysAlong = 28
const baysAround = 4
/** Gothic rose-window and quatrefoil filigree signed field in a near-square cell. Negative values are open piercings where the outer gilt shell is cut away. */
function traceryField(cells: Node<'vec2'>) {
  const local = cells.fract().sub(0.5)
  const r = local.length()
  const angle = atan(local.y, local.x.add(1e-6))
// Central rose window with 8 cusped petals and a solid central boss.
  const rosePetals = angle.mul(8).cos().mul(0.055).add(0.32)
  const bossOpening = r.sub(0.088)
  const roseOpening = r.sub(rosePetals).max(bossOpening.negate())
// Four corner lancet apertures shared across cell boundaries.
  const corner = local.abs().sub(0.5)
  const cornerR = corner.length()
  const cornerAngle = atan(corner.y, corner.x.add(1e-6))
  const trefoil = cornerR.sub(cornerAngle.mul(4).cos().mul(0.035).add(0.21))
// Diagonal and cardinal rib struts that frame the rose and corner lancets; negative is solid rib, positive is open window.
  const diagRib = float(0.036).sub(local.x.abs().sub(local.y.abs()).abs().mul(0.7071))
  const borderRib = local.x.abs().max(local.y.abs()).sub(0.455)
  const opening = roseOpening.min(trefoil).max(diagRib).max(borderRib)
  return {
    angle,
    boss: bossOpening.smoothstep(-0.02, 0.01).oneMinus(),
    local,
    opening,
    r,
  }
}
const outerCanopy = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const cells = tubeCells(tube, baysAlong, baysAround)
  const {opening} = traceryField(cells)
  const ribProfile = opening.smoothstep(0, 0.08).mul(0.0045)
  return position.add(normal.mul(float(0.01).add(ribProfile)))
})
const innerCoreSurface = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  return position.sub(normal.mul(0.014))
})
/** Two-mesh Gothic thurible: an outer pierced gilt-bronze cage with `maskNode` windows suspended above a recessed crimson velvet & glowing frankincense-coal core mesh. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    this.side = DoubleSide
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const cells = tubeCells(tube, baysAlong, baysAround)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0005)
    const {opening, r, angle, boss} = traceryField(cells)
// Cut out pixels inside the Gothic rose and lancet windows so the recessed core mesh is revealed in true 3D depth.
    this.maskNode = opening.greaterThan(0)
    const eps = 0.00012
    const du = outerCanopy(tube.add(vec2(eps, 0))).sub(outerCanopy(tube.sub(vec2(eps, 0))))
    const dv = outerCanopy(tube.add(vec2(0, eps))).sub(outerCanopy(tube.sub(vec2(0, eps))))
    const canopyNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = outerCanopy(tube)
// Bevel and cable-molding engraving along every stone/bronze tracery rib.
    const bevel = opening.smoothstep(0, 0.055)
    const rimHighlight = opening.smoothstep(0, footprint.mul(1.8).add(0.022)).oneMinus()
    const guilloche = angle.mul(32).add(r.mul(90)).sin().mul(0.5).add(0.5).mul(footprint.smoothstep(0.012, 0.04).oneMinus())
    const rubyCabochon = r.smoothstep(0.052, 0.06).oneMinus()
    const verdigrisCrevice = bevel.oneMinus().mul(0.75)
    const antiqueBronze = color(hsl.integer(56, 61, 13))
    const burnishedGold = color(hsl.integer(80, 86, 79))
    const verdigris = color(hsl.integer(173, 98, 54))
    const ruby = color(hsl.integer(23, 99, 51))
    const metalColor = mix(mix(antiqueBronze, burnishedGold, bevel.mul(0.85).add(0.15)), verdigris, verdigrisCrevice.mul(0.58))
    this.colorNode = mix(metalColor.mul(guilloche.mul(0.18).add(0.86)), ruby, rubyCabochon)
    this.metalnessNode = rubyCabochon.oneMinus().mul(verdigrisCrevice.mul(-0.42).add(0.96))
    this.roughnessNode = mix(float(0.15).add(verdigrisCrevice.mul(0.32)).add(guilloche.mul(0.06)), float(0.03), rubyCabochon)
    this.clearcoatNode = rubyCabochon.mul(0.75).add(0.25)
    this.clearcoatRoughness = 0.04
    const height = bevel.mul(0.003).add(guilloche.mul(0.00038)).add(rubyCabochon.mul(0.002)).add(boss.mul(0.0012))
    this.normalNode = detailNormal(canopyNormal, height, 0.95)
// Warm inner-coal bounce light catching the underside bevels of the pierced bronze openings.
    const breath = time.mul(Math.PI).sin().mul(0.35).add(0.65)
    this.emissiveNode = color(hsl.integer(40, 100, 62.9)).mul(rimHighlight).mul(breath.mul(0.8).add(0.5))
      .add(ruby.mul(rubyCabochon).mul(breath.mul(0.9).add(0.5)))
      .add(color(hsl.integer(170, 94, 79)).mul(verdigrisCrevice).mul(grazing.pow(2.5)).mul(0.22))
      .add(color(hsl.integer(85, 100, 87.8)).mul(rimHighlight).mul(grazing.pow(2)).mul(0.38))
// Recessed inner sanctuary mesh rendered beneath the pierced outer canopy.
    const core = new MeshPhysicalNodeMaterial({
      envMap: environment,
      envMapIntensity: 0.5,
    })
    core.positionNode = innerCoreSurface(tube)
    const coreCells = tubeCells(tube, baysAlong * 2, baysAround * 2)
    const quilt = coreCells.x.mul(TAU).cos().mul(coreCells.y.mul(TAU).cos()).mul(0.5).add(0.5)
    const emberDrift = p.mul(14).add(vec3(time.mul(Math.PI).cos().mul(0.35), time.mul(Math.PI).sin().mul(0.35), 0))
    const coalCracks = mx_noise_float(emberDrift).abs().smoothstep(0.03, 0.26).oneMinus()
    const sparks = cellularPoints(p.mul(34).add(vec3(0, time.mul(Math.PI).sin().mul(0.2), 0)), 0.05, 0.21, 0.48)
    const incenseSmoke = mx_noise_float(p.sub(view.mul(0.06)).mul(9).add(vec3(0, time.mul(Math.PI).cos().mul(0.4), 0))).mul(0.5).add(0.5)
    const velvetColor = mix(color(hsl.integer(6, 88, 13)), color(hsl.integer(14, 96, 36)), quilt.mul(0.75).add(0.25))
    core.colorNode = mix(velvetColor, color(hsl.integer(32, 45, 6)), coalCracks.mul(0.75))
    core.metalness = 0.08
    core.roughnessNode = float(0.58).sub(coalCracks.mul(0.35))
    core.sheenNode = color(hsl.integer(8, 100, 61)).mul(0.95)
    core.sheenRoughness = 0.26
    core.normalNode = proceduralNormal(quilt.mul(0.0024).sub(coalCracks.mul(0.002)), 1)
    const coalHeat = coalCracks.mul(breath.mul(0.7).add(0.7)).add(sparks.mul(2.2))
    const fireColor = mix(color(hsl.integer(30, 100, 57)), color(hsl.integer(94, 100, 89.6)), coalCracks.pow(1.8).add(sparks).clamp())
    core.emissiveNode = fireColor.mul(coalHeat).mul(near.mul(0.75).add(0.85))
      .add(color(hsl.integer(284, 100, 48)).mul(incenseSmoke.pow(1.8)).mul(facing).mul(intimate.mul(0.85).add(0.48)))
    this.coreMaterial = core
  }
}
