import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, uv, vec2, vec3} from 'three/tsl'

import {filteredCos} from '../../candidates/claude_opus/lib/filteredWeave.ts'
import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameSurface.ts'
import {knotCircumference, knotLength, tubeMetric} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Whole thread counts along the knot and around the tube keep every grating continuous across both seams. */
const grating = (along: number, around: number) => vec2(TAU * along / knotLength, TAU * around / knotCircumference)
/** Outer veil: a fine warp running around the tube plus a sparser weft. Inner veil: the same warp, rotated and reset by a hair. */
const outerWarp = grating(2300, 9)
const outerWeft = grating(31, 236)
const innerWarp = grating(2318, 4)
/** Gap between the veils in object units, and how far the outer veil billows. */
const gap = 0.0042
const billow = 0.0022
/**
 * Moiré silk. Two sheer veils of fine thread lie a breath apart; neither is visible as a pattern on its own, but where
 * their threads fall in and out of step the eye sees broad tides of light – the beat of two gratings. The gap between
 * the veils makes the beat slide by many bands for a tiny change of viewpoint, and the outer veil is calendered into the
 * flowing wood-grain of moiré antique and stirs in a slow draft. Every grating is filtered analytically, so the threads
 * dissolve smoothly below a pixel while their beats remain sharp at any distance.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing} = viewerFrame()
    const frame = knotFrame(tube)
    const n = normalLocal.normalize()
    const x = tubeMetric(tube)
// Calendering crushes the outer veil into a flowing watermark: a slow warp of its threads.
    const watermark = mx_fractal_noise_float(p.mul(vec3(1.3, 1.3, 1.3)).add(vec3(0, 0, time.mul(0.018))), 3, 2.1, 0.5).mul(5.5)
      .add(mx_noise_float(p.mul(5.2).add(vec3(time.mul(0.03), 0, 0))).mul(0.9))
// A draft lifts the outer veil off the inner one in slow swells.
    const swell = mx_noise_float(p.mul(2.4).add(vec3(0, time.mul(0.11), 0))).mul(0.5).add(0.5)
    const depth = swell.mul(billow).add(gap)
// Parallax: seen through the outer veil, the inner one slides opposite to the viewer’s step.
    const lean = view.sub(n.mul(view.dot(n))).div(view.dot(n).abs().max(0.3))
    const shift = vec2(lean.dot(frame.along), lean.dot(frame.around)).mul(depth)
    const inner = x.sub(shift)
    const warpA = x.dot(outerWarp).add(watermark.mul(TAU))
    const weftA = x.dot(outerWeft).add(mx_noise_float(p.mul(3.1)).mul(2))
    const warpB = inner.dot(innerWarp)
// Optical stack. Where the veils fall in step, the inner threads hide behind the outer ones and the gaps line up onto the
// dark lining; out of step, the inner threads fill every gap. Only the beat survives filtering at a distance.
    const beat = filteredCos(warpA.sub(warpB))
    const open = beat.mul(-0.5).add(0.5)
    const tide = open.smoothstep(0.08, 0.92)
    const outerThreads = filteredCos(warpA).mul(0.5).add(0.5)
    const innerThreads = filteredCos(warpB).mul(0.5).add(0.5)
    const weft = filteredCos(weftA).mul(0.5).add(0.5)
    const sheer = outerThreads.mul(0.38).add(weft.mul(0.12)).add(0.06).clamp(0, 0.6)
// Shot silk: warp and weft are dyed differently, so the outer veil turns from crimson to gold as you walk around it.
    const across = view.dot(frame.along).abs()
    const shot = across.smoothstep(0.05, 0.7)
    const outerColor = mix(color(hsl.integer(11, 88, 28.4)), color(hsl.integer(79, 87, 72)), shot)
    const innerColor = mix(color(hsl.integer(259, 89, 26)), color(hsl.integer(200, 82, 70)), facing.pow(2)).mul(innerThreads.mul(0.35).add(0.82))
    const liningColor = color(hsl.integer(306, 38, 4))
    const seen = mix(liningColor, innerColor, tide)
    const base = mix(seen, outerColor, sheer)
    this.colorNode = base.mul(1.15)
    this.metalness = 0
    this.roughness = 0.42
// Silk fibers stretch their highlight across the threads.
    this.anisotropyNode = vec2(0.75, 0)
    this.sheenNode = mix(color(hsl.integer(79, 99, 84)), color(hsl.integer(212, 99, 86)), tide).mul(0.9)
    this.sheenRoughness = 0.32
    this.specularIntensity = 0.6
// A whisper of light from within the beats keeps the tides legible in soft gallery light.
    this.emissiveNode = innerColor.mul(tide.mul(sheer.oneMinus())).mul(0.22).add(color(hsl.integer(78, 100, 89)).mul(grazing.pow(3)).mul(0.04))
  }
}
