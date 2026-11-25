import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Leaded glass: hand-cut worley quarries with soldered came borders, each pane its own glass recipe. */
function panes(tile: Node<'vec2'>, cols: Node<'float'> | number, rows: Node<'float'> | number) {
  const size = vec2(cols, rows)
  const q = tile.mul(size)
  const cell = q.floor()
  const id = wrapCell(cell, size)
  const local = q.fract().sub(0.5)
  const random = cellNoiseVec3(vec3(id.x, id.y, 0))
  const bend = mx_noise_float(vec3(tile.x.mul(3), tile.y.mul(3), 0)).mul(0.12)
  const seam = mx_worley_noise_vec3(tile.add(vec2(bend, bend.mul(-0.6))).add(0.5), 1, 0)
  const gap = seam.y.sub(seam.x)
  const footprint = gap.fwidth().max(0.0004)
  const cameWidth = footprint.mul(1.4).add(0.06)
  const cameCore = gap.smoothstep(0.02, 0.06).oneMinus()
  const came = gap.smoothstep(cameWidth.mul(0.35), cameWidth).oneMinus()
  return {
    came: came.clamp(0, 1),
    cameCore: cameCore.clamp(0, 1),
    glass: came.oneMinus().clamp(0, 1),
    glassCore: cameCore.oneMinus().clamp(0, 1),
    local,
    random,
  }
}

/** A rose window poured into a knot: quarries of pot-metal glass, each pane a different century's idea of blue, soldered together with dark came. The sun has already set behind it, so the glass keeps its own inner fire — and as you pass, the came throws its leaden lattice across every color in turn. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const tile = uv().mul(vec2(2, 1))
    const panesField = panes(tile, 26, 6)
    const seed = beads(p.mul(160).add(55), 61)
    const names = panesField.random
    const jewel = mix(mix(mix(color(hsl.integer(21, 94, 33)), color(hsl.integer(266, 94, 27.5)), names.x.smoothstep(0.15, 0.35)), mix(color(hsl.integer(71, 96, 60)), color(hsl.integer(154, 97.6, 38)), names.x.smoothstep(0.5, 0.7)), names.y.smoothstep(0.3, 0.7)), color(hsl.integer(299, 86, 32)), names.z.smoothstep(0.55, 0.85))
    const breath = mx_noise_float(p.mul(3).add(vec3(time.mul(0.06), float(0), float(0)))).mul(0.5).add(0.5)
    const flash = view.dot(vec3(0.3, 0.2, 0.93).normalize()).abs().pow(3)
    const height = panesField.glassCore.mul(0.7).sub(panesField.cameCore.mul(0.55)).add(seed.core.mul(intimate).mul(0.5))
    this.positionNode = positionGeometry.add(normalLocal.mul(height.mul(0.0035)))
// Per-pane facet tilt so highlights break across the quarries instead of sweeping the whole tube.
    const paneTilt = panesField.random.sub(0.5).mul(panesField.glass.mul(0.35))
    this.normalNode = proceduralNormal(height, 0.5).add(normalLocal.mul(panesField.came.mul(-0.25))).add(paneTilt).normalize()
    this.colorNode = mix(jewel.mul(0.35), color(hsl.integer(261, 10, 16)), panesField.came.clamp(0, 1))
    this.metalnessNode = panesField.came.mul(0.8)
    this.roughnessNode = float(0.12).add(panesField.came.mul(0.55)).add(seed.mask.mul(0.08))
    this.clearcoat = 0.85
    this.clearcoatRoughnessNode = float(0.05).add(panesField.came.mul(0.3))
    this.aoNode = panesField.came.mul(0.5).oneMinus()
    this.envMapIntensity = 0.55
// Backlight through the panes: deep fire in the body, flaring where the eye lines up with the glass.
    const lamp = jewel.mul(breath.mul(0.6).add(0.5)).mul(panesField.glass)
    const streak = jewel.mul(flash.mul(panesField.glass).mul(1.1))
    const leadSpark = glints(normalLocal, 120).mul(panesField.came).mul(near).mul(0.5)
    this.emissiveNode = lamp.mul(1.35).add(streak).add(color(hsl.integer(0, 0, 100)).mul(leadSpark)).add(jewel.mul(grazing.pow(2.5).mul(panesField.glass).mul(0.45)))
  }
}
