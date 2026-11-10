import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {cameraPosition, color, float, hash, max, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, select, time, vec2, vec3, vec4} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {along, assembleFrame, corners, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import {dome} from '../lib/ornaments.ts'

type Float = Node<'float'>

const imageDepth = -0.06
const flesh = 0
const eye = 1
/** a soft fold of flesh at the sight edge, a crease, then a swollen roll the eyes open in, rolling down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], flesh)
  .line(-0.005, -0.05)
  .arc(0.02, -0.046, 0.35, {steps: 8})
  .arc(0.03, -0.05, -0.3, {steps: 4})
  .arc(0.1, -0.044, 0.28, {steps: 14})
  .arc(0.118, -0.07, 0.3, {steps: 6})
  .line(0.118, frameBack)
  .line(-0.005, frameBack)
/** the eyes bulging out of the roll: how far out and forward they sit, how large they are along the members and on the corners, and how far they bulge */
const eyes = {
  r: 0.065,
  z: -0.034,
  radius: 0.03,
  cornerRadius: 0.036,
  bulge: 0.016,
}
/** seconds between two heartbeats */
const heartbeat = 1.15
/** How far the veins are swollen with the heartbeat, 0 to 1: a strong beat and a weaker one right after it. */
function pulse(): Float {
  const phase = time.div(heartbeat).fract()
  return phase.sub(0.06).div(0.08).mul(phase.sub(0.06).div(0.08)).negate().exp().add(phase.sub(0.3).div(0.07).mul(phase.sub(0.3).div(0.07)).negate().exp().mul(0.55))
}
/**
 * Skin over the frame: sickly and blotched with bruises, purple and yellow-green, crossed by veins that swell and darken with every heartbeat, glistening in its creases. Returns its color, how strongly it shines and its relief.
 */
function skin(surface: FrameSurface) {
  const p = surface.position
  const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
  const beat = pulse()
  const bruises = mx_noise_float(p.mul(7).add(vec3(3.1, 0, 1.7))).smoothstep(0.3, 0.75)
  const yellowing = mx_noise_float(p.mul(6).add(vec3(0, 5.3, 0))).smoothstep(0.3, 0.7)
  const raw = mx_noise_float(p.mul(12).add(vec3(1.1, 2.2, 0))).smoothstep(0.3, 0.6)
  const mottle = mx_noise_float(p.mul(60)).mul(0.5).add(0.5)
  const lumps = mx_noise_float(p.mul(28)).mul(0.5).add(0.5)
  // Veins only show where the skin is thin, branching off thicker trunks.
  const veinPoint = p.mul(18).add(mx_noise_vec3(p.mul(7)).mul(0.9))
  const thin = mx_noise_float(p.mul(5).add(vec3(7.7, 0, 0))).smoothstep(-0.1, 0.4)
  const trunks = mx_noise_float(veinPoint).abs().smoothstep(beat.mul(0.03).add(0.07), 0).pow(0.8)
  const branches = mx_noise_float(veinPoint.mul(2.4).add(4.1)).abs().smoothstep(0.045, 0).mul(0.6)
  const veins = trunks.add(branches).mul(thin).mul(visibleDetail(footprint, 0.003)).clamp(0, 1)
  const pores = mx_noise_float(p.mul(900)).mul(visibleDetail(footprint, 0.0015))
  const hollow = surface.cavity.smoothstep(0, 0.8)
  const pallid = mix(color('#94645a'), color('#bd8f7e'), mottle.mul(0.5).add(lumps.mul(0.3)))
  const bruised = mix(mix(pallid, color('#4e2040'), bruises.mul(0.7)), color('#857a34'), yellowing.mul(bruises.oneMinus()).mul(0.5))
  const inflamed = mix(bruised, color('#8a1c1a'), raw.mul(0.75).max(hollow.mul(0.85)))
  const veined = mix(inflamed, mix(color('#3a2a5e'), color('#5e0410'), beat), veins.mul(beat.mul(0.2).add(0.5)))
  return {
    color: veined,
    veins,
    beat,
    wet: hollow.max(raw.mul(0.8)),
    height: veins.mul(beat.mul(0.0003).add(0.00015)).add(pores.mul(0.000015)).add(lumps.mul(0.0012)),
  }
}
/** A placement without its turn, upright and unscaled, so an eye’s own coordinates are the viewer’s, in meters. */
const upright = ({position}: {position: readonly [number, number, number]}) => ({position})

/** One of the Horror Orb’s frames: living flesh, bruised and veined, its veins pulsing with a heartbeat, stitched shut across its miters, with eyes opening in it that follow whoever walks by and blink, each at its own pace. */
export default class FleshFrame extends PortraitFrame {
  override readonly description = 'Something alive has grown round the work: swollen rolls of bruised, sickly flesh, stitched shut across every miter with black thread, its veins swelling with a slow heartbeat, and in it bloodshot eyes that blink, each at its own pace, and follow whoever walks by.'
  override readonly front = eyes.z + eyes.bulge * eyes.cornerRadius / eyes.radius
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#b88d84'
  override readonly title = 'Watching flesh'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const eyeball = (radius: number, kind: number) => dome(radius, eyes.bulge * radius / eyes.radius, {
      segments: 14,
      rings: 4,
      kind,
    })
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [eye, place(eyeball(eyes.cornerRadius, 2), corners(halfWidth, halfHeight, eyes.r, eyes.z).map(upright))],
      [eye, place(eyeball(eyes.radius, 1), along(halfWidth, halfHeight, eyes.r, eyes.z, {
        spacing: 0.34,
        inset: 0.22,
        limit: 8,
      }).map(upright))],
    ])
  }

  protected override createMaterials() {
    return [new FleshMaterial, new EyeMaterial]
  }
}

/** The flesh of the mouldings, and the black stitches closing it across the miters over a raw red seam. */
class FleshMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.7,
      sheen: 0.5,
      sheenRoughness: 0.4,
      sheenColor: '#ffb0a0',
      clearcoat: 0.6,
      clearcoatRoughness: 0.18,
    })
    const surface = frameSurface()
    const {color: tone, wet, height, veins, beat} = skin(surface)
    // Every miter is a raw seam, stitched shut across with black thread every 12 mm.
    const seam = line(surface.toCorner, 0.0012).mul(surface.isOrnament.oneMinus())
    const stitch = surface.reach.div(0.012).add(0.5).fract().sub(0.5).abs().mul(0.012)
    const thread = line(stitch, 0.0007).mul(surface.toCorner.smoothstep(0.0075, 0.005)).mul(surface.isOrnament.oneMinus())
    const raw = seam.max(surface.toCorner.smoothstep(0.004, 0).mul(0.4).mul(surface.isOrnament.oneMinus()))
    this.colorNode = mix(mix(tone, color('#5a0a10'), raw), color('#120c0c'), thread)
    this.emissiveNode = color('#ff1a1a').mul(veins.mul(beat).mul(0.12))
    this.roughnessNode = mix(float(0.42), float(0.14), wet.max(raw))
    this.normalNode = heightNormal(height.add(thread.mul(0.0006)).sub(seam.mul(0.0008)))
  }
}
/**
 * The eyes: under lids of the same flesh, each opens to a bloodshot, jaundiced eyeball whose iris turns toward the camera, its pupil wide; it blinks once in a few seconds of its own, now and then twice, and lies wet and glistening.
 */
class EyeMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    // In units of the eye’s radius, upright: every eye is placed unturned, so its own coordinates are the viewer’s.
    const radius = select(surface.member.sub(4).round().equal(2), float(eyes.cornerRadius), float(eyes.radius))
    const q = vec2(surface.along, surface.across).div(radius)
    const middle = p.xy.sub(vec2(surface.along, surface.across))
    const seed = hash(middle.x.mul(91.7).add(middle.y.mul(37.3)))
    // Blinking once in a stretch of 3 to 6 seconds of its own, at a random moment within it, now and then twice in a row.
    const period = seed.mul(3).add(3)
    const t = time.add(seed.mul(40))
    const stretch = t.div(period).floor()
    const into = t.sub(stretch.mul(period))
    const at = hash(stretch.add(seed.mul(13))).mul(period.sub(0.8))
    const shut = (start: Float) => float(1).sub(into.sub(start).sub(0.11).abs().div(0.11)).clamp(0, 1).smoothstep(0, 0.6)
    const twice = hash(stretch.add(seed.mul(13).add(0.5))).greaterThan(0.7).select(float(1), float(0))
    const blink = shut(at).max(shut(at.add(0.34)).mul(twice))
    // The lids part in an almond, narrower while it blinks.
    const opening = float(0.62).mul(blink.oneMinus()).mul(float(1).sub(q.x.div(0.92).pow(2)).max(0).sqrt())
    const lid = q.y.abs().sub(opening).mul(radius)
    const open = inside(lid).mul(q.x.abs().lessThan(0.92).select(float(1), float(0)))
    // The iris turns toward the camera, as far as the eyeball lets it.
    const camera = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const toward = camera.sub(vec3(middle, eyes.z)).normalize()
    const look = toward.xy.div(toward.z.max(0.25)).mul(0.32)
    const gaze = look.mul(float(0.25).div(look.length().max(0.25)))
    const irisAt = q.sub(gaze)
    const radial = irisAt.length()
    const iris = inside(radial.sub(0.4).mul(radius))
    const pupil = inside(radial.sub(0.2).mul(radius))
    const fibers = mx_noise_float(vec3(irisAt.normalize().mul(6), radial.mul(4))).mul(0.5).add(0.5)
    const irisColor = mix(color('#d9a21e'), color('#3f7a1f'), radial.smoothstep(0.1, 0.4)).mul(fibers.mul(0.7).add(0.5))
    const veins = float(1).sub(mx_noise_float(vec3(q.mul(5), seed.mul(9))).abs().mul(9)).max(0).pow(2).mul(radial.smoothstep(0.45, 0.9)).mul(visibleDetail(footprint, 0.002))
    const sclera = mix(mix(color('#e3d3a6'), color('#c0705a'), radial.smoothstep(0.5, 1.1)), color('#9a0d12'), veins)
    const ball = mix(mix(sclera, irisColor, iris), vec3(0.01), pupil)
    const {color: tone, height} = skin(surface)
    const lash = line(lid, 0.0007)
    // The lids are swollen and red round the eye.
    const rims = lid.smoothstep(0.004, 0).mul(open.oneMinus())
    this.colorNode = mix(mix(mix(tone, color('#8e2424'), rims.mul(0.8)), ball, open), color('#2a0a0a'), lash.mul(0.8))
    this.emissiveNode = irisColor.mul(iris.mul(pupil.oneMinus()).mul(open).mul(0.25))
    this.roughnessNode = mix(float(0.5), float(0.06), open)
    this.normalNode = heightNormal(height.mul(open.oneMinus()).add(lid.min(0).mul(0.05).mul(open.oneMinus())))
  }
}
