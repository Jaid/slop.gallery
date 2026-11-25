import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, transformNormalToView, vec2, vec3} from 'three/tsl'

import {environmentContrast} from '../../candidates/claude_opus/lib/environmentLight.ts'
import {knotLength, surfaceFrame, torusDomain, tubeCircumference, tubeSpace} from '../../candidates/claude_opus/lib/knotSpace.ts'
import {wavelengthToRgb} from '../../candidates/claude_opus/lib/spectrum.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Scale rows: diamonds along the whole knot and around the tube. Integers keep the lattice seamless. */
const scalesAlong = 108
const scalesAround = 16
/** Physical lattice spacing in object units, for converting scale relief into surface slope. */
const spacingAlong = knotLength / scalesAlong
const spacingAround = tubeCircumference / scalesAround
/** Peak lift of a scale’s free edge, in object units. */
const lift = 0.0065
/** The skin glides along the knot, in knot laps per second. */
const glide = 0.0045
/** Overlapping keeled scales on a body that swallows itself. The whole skin glides endlessly along the knot while a slow muscular wave lifts the scales as it passes. Each plate carries a microscopic film whose thickness differs from scale to scale and from base to tip, so walking around the piece sends rainbows rippling across the dark body like on a sunbeam snake. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {along, around} = tubeSpace()
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const {normal, along: alongDirection, around: aroundDirection} = surfaceFrame()
    const travel = along.sub(time.mul(glide))
    const x = travel.mul(scalesAlong)
    const y = around.mul(scalesAround)
    const u = x.add(y)
    const v = x.sub(y)
    const cu = u.fract().sub(0.5)
    const cv = v.fract().sub(0.5)
// t runs from a scale’s buried base (0) to its free tip (1); w runs across it.
    const t = cu.add(cv).add(1).mul(0.5)
    const w = cu.sub(cv)
// Seam-safe identity: the sum and difference of the diamond indices are periodic in 2N and 2M.
    const iu = u.floor()
    const iv = v.floor()
    const key = vec2(iu.add(iv).mod(2 * scalesAlong), iu.sub(iv).mod(2 * scalesAround))
    const identity = cellNoiseVec3(vec3(key, 7.3))
// The muscular wave, traveling against the glide: scales flare as it passes.
    const wave = travel.mul(TAU * 6).add(time.mul(0.9)).sin().mul(0.5).add(0.5).pow(3)
    const flare = wave.mul(0.7).add(0.65)
// Unresolved scales flatten to the mean surface instead of aliasing.
    const footprint = x.fwidth().max(y.fwidth())
    const resolved = footprint.smoothstep(0.25, 0.8).oneMinus()
// Relief: a tilted, slightly domed plate with a central keel; analytic slopes in object units.
    const keelWidth = 0.13
    const keel = w.div(keelWidth).pow2().negate().exp()
    const dome = w.pow2().mul(-0.45).add(1)
    const ramp = t.mul(0.55).add(t.pow2().mul(0.45))
    const dRamp = t.mul(0.9).add(0.55)
    const keelHeight = 0.35
    const slopeAlong = dRamp.mul(dome).add(keel.mul(keelHeight)).mul(lift / spacingAlong)
    const slopeAround = ramp.mul(w).mul(-0.9).add(keel.mul(t).mul(keelHeight).mul(w).mul(-2 / (keelWidth * keelWidth))).mul(2 * lift / spacingAround)
    const tilt = vec2(slopeAlong, slopeAround).mul(flare).mul(resolved)
    const scaleNormal = normal.sub(alongDirection.mul(tilt.x)).sub(aroundDirection.mul(tilt.y)).normalize()
    this.normalNode = transformNormalToView(scaleNormal)
// Pattern: bronze chevrons sampled at each scale’s center, so whole scales change color like a mosaic.
    const centerAlong = iu.add(iv).add(1).mul(0.5).div(scalesAlong)
    const centerAround = iu.sub(iv).mul(0.5).div(scalesAround)
    const chevronPhase = centerAlong.mul(26).add(centerAround.mul(TAU).cos().mul(0.9)).add(mx_noise_float(torusDomain(centerAlong, centerAround, 40, 2.5)).mul(0.6))
    const chevron = chevronPhase.fract().sub(0.5).abs().smoothstep(0.12, 0.2).oneMinus().mul(identity.z.smoothstep(0.15, 0.35))
// Shadows: each scale’s base hides under the tip of the one before it; a dark groove marks the overlap.
    const edge = float(0.5).sub(cu.abs()).min(float(0.5).sub(cv.abs()))
    const edgeFootprint = edge.fwidth().max(0.0001)
    const groove = edge.smoothstep(edgeFootprint.mul(0.5), edgeFootprint.mul(1.5).add(0.03)).oneMinus().mul(resolved)
    const overlap = t.smoothstep(0, 0.38).mul(0.55).add(0.45)
    const shade = mix(float(0.78), overlap.mul(groove.mul(0.7).oneMinus()), resolved)
    const ink = mix(color(hsl.integer(51, 16, 5.5)), color(hsl.integer(62, 23, 8)), identity.x)
    const bronze = mix(color(hsl.integer(65, 66, 29)), color(hsl.integer(82, 70, 47)), identity.y)
    this.colorNode = mix(ink, bronze, chevron).mul(shade)
    this.metalness = 0
    this.roughnessNode = mix(float(0.24), float(0.16), keel.mul(resolved)).add(identity.y.mul(0.06))
    this.ior = 1.56
    this.specularIntensity = 1
    this.aoNode = shade.mul(0.6).add(0.4)
// The film: thickness varies per scale and thins from base to tip, so each plate holds its own spectrum.
    const filmThickness = identity.x.mul(260).add(320).sub(t.mul(70)).add(wave.mul(60))
    this.iridescence = 1
    this.iridescenceIOR = 1.75
    this.iridescenceThicknessNode = filmThickness
// Rainbows in the room’s lights: thin-film color sampled at the angle the eye meets each scale, strongest in reflections of
// bright sources – the effect that makes a sunbeam snake look oil-slicked.
    const cosine = view.dot(scaleNormal).clamp(0.05, 1)
    const opticalPath = filmThickness.mul(2 * 1.75).mul(cosine.pow2().oneMinus().div(1.75 * 1.75).oneMinus().sqrt())
    let film: Node<'vec3'> = vec3(0)
    for (const order of [1, 2]) {
      film = film.add(wavelengthToRgb(opticalPath.div(order)).mul(1 / order))
    }
    const reflected = view.negate().reflect(scaleNormal)
    const highlight = environmentContrast(environment, reflected, 0.18).sub(0.9).max(0).pow(1.3)
    const rainbow = film.mul(highlight).mul(shade).mul(0.5)
// A deep sheen at the limb, and a warm glint of the keel close up.
    this.emissiveNode = rainbow.mul(near.mul(0.3).add(0.85))
      .add(film.mul(grazing.pow(3)).mul(0.08).mul(shade))
      .add(color(hsl.integer(68, 67, 56)).mul(keel.mul(t).pow(3)).mul(intimate).mul(facing).mul(0.04).mul(resolved))
  }
}
