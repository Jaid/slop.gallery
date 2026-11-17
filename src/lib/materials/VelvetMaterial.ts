import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_noise_float, normalViewGeometry, positionViewDirection, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

/** The colors of a velvet, as sRGB hex strings. */
export type VelvetStyle = {
  /** the crushed pile where it lies flat and catches the light */
  crushed: string
  /** the pile standing upright, swallowing the light */
  deep: string
  /** the body of the fabric between the two */
  pile: string
  /** the soft glow the fibers scatter at grazing angles */
  sheen: string
}

type Float = Node<'float'>

/** Deep oxblood crushed velvet. */
export const oxbloodVelvet: VelvetStyle = {
  crushed: '#8e0a1d',
  deep: '#1c0104',
  pile: '#52040f',
  sheen: '#d01a34',
}

const unit = (node: Float) => node.mul(0.5).add(0.5)
const noise = (x: Float, y: Float, seed: Float) => mx_noise_float(vec3(x, y, seed))

export type VelvetOptions = {
  seed?: number
  style?: VelvetStyle
}

/**
 * Crushed velvet laid out in meters of cloth: across the nap in u, along it in v.
 * The pile lies flat in drifting patches, lighter and shinier than the upright pile around them. Short strokes
 * lean in different directions within those patches; their tufts and fibers fade before they could shimmer.
 */
export default class VelvetMaterial extends MeshPhysicalNodeMaterial {
  constructor(coordinates: Node<'vec2'>, {seed = 0, style = oxbloodVelvet}: VelvetOptions = {}) {
    super({
      // Pile scatters back toward the light and looks flatter than a Lambertian surface (EON).
      diffuseRoughness: 1,
      envMapIntensity: 0.08,
      metalness: 0,
      roughness: 0.9,
      // Fibers are a weak, dielectric mirror.
      specularIntensity: 0.6,
    })
    this.name = 'Crushed velvet'
    const u = coordinates.x.toVar('velvetU')
    const v = coordinates.y.toVar('velvetV')
    const footprint = max(u.fwidth(), v.fwidth()).toVar('velvetFootprint')
    const s = float(seed * 17.3 + 3.1)
    // A noise of the given period (meters) is faded to its average before it spans fewer than about two and a half pixels, where it would turn into speckle.
    const resolved = (period: number) => visibleDetail(footprint, period / 1.5)
    // Relief comes from screen-space derivatives, which turn to per-pixel noise much sooner, so it fades out while its period still spans about six pixels.
    const relief = (period: number) => visibleDetail(footprint, period / 3.6)
    // Crushing: folded patches where the pile lies flat, a hand to an arm’s length across.
    const warpU = noise(u.mul(0.45), v.mul(0.45), s).mul(0.3)
    const warpV = noise(u.mul(0.45), v.mul(0.45), s.add(1)).mul(0.3)
    const qu = u.add(warpU).toVar('velvetWarpU')
    const qv = v.add(warpV).toVar('velvetWarpV')
    const broadCrush = unit(noise(qu.mul(1.1), qv.mul(1.1), s.add(2)))
    const fineCrush = mix(float(0.5), unit(noise(qu.mul(3.4), qv.mul(3.4), s.add(3))), resolved(0.3))
    const crush = broadCrush.mul(0.62).add(fineCrush.mul(0.38)).smoothstep(0.32, 0.78).toVar('velvetCrush')
    // The nap: long brushed strokes whose course bends with a slow drift of the fabric.
    const stroke = u.add(noise(u.mul(0.5), v.mul(0.5), s.add(4)).mul(0.22))
    const nap = mix(float(0.5), unit(noise(stroke.mul(34), v.mul(0.6), s.add(5))), resolved(1 / 34)).toVar('velvetNap')
    // Pressing laid the pile down in small clumps of short strokes, all leaning one way within a patch and another way in the next.
    // Each direction is its own noise in fixed, straight coordinates, blended patch by patch; rotating the coordinates by a varying angle instead would shear them far from the origin.
    const patch = unit(noise(qu.mul(2.2), qv.mul(2.2), s.add(9))).toVar('velvetPatch')
    const first = patch.smoothstep(0.22, 0.42).oneMinus()
    const third = patch.smoothstep(0.58, 0.78)
    const second = float(1).sub(first).sub(third)
    const pressedAt = (angle: number, seedOffset: number) => {
      const along = u.mul(Math.cos(angle)).add(v.mul(Math.sin(angle)))
      const across = v.mul(Math.cos(angle)).sub(u.mul(Math.sin(angle)))
      return unit(noise(along.mul(30), across.mul(90), s.add(seedOffset)))
    }
    const strokes = pressedAt(0.35, 10).mul(first).add(pressedAt(1.4, 11).mul(second)).add(pressedAt(2.45, 12).mul(third))
    const pressed = mix(float(0.5), strokes, resolved(1 / 90)).toVar('velvetPressed')
    // The pile catches the light a little differently in every direction it leans.
    const facing = third.sub(first).mul(0.07)
    // Clumps of the pile, tufts and the fibers themselves, from a few centimeters down to a few millimeters.
    const clumps = mix(float(0.5), unit(noise(u.mul(25), v.mul(22), s.add(13))), resolved(1 / 25))
    const tufts = mix(float(0.5), unit(noise(u.mul(60), v.mul(52), s.add(7))), resolved(1 / 60))
    const fibers = mix(float(0.5), unit(noise(u.mul(170), v.mul(140), s.add(8))), resolved(1 / 170))
    // Upright pile swallows the light; the crushed patches, the pressed strokes and the tips of the tufts catch it.
    const light = float(0.31).add(crush.mul(0.15)).add(pressed.sub(0.5).mul(0.4)).add(facing).add(nap.sub(0.5).mul(0.1)).add(clumps.sub(0.5).mul(0.3)).add(tufts.sub(0.5).mul(0.3)).add(fibers.sub(0.5).mul(0.25)).clamp(0, 1).toVar('velvetLight')
    const body = mix(color(style.deep), color(style.pile), light.smoothstep(0, 0.45))
    // Seen at a slant, the eye looks along the fibers into their lit flanks rather than down into the shadowed pile, so velvet brightens toward grazing angles.
    const slant = normalViewGeometry.dot(positionViewDirection).abs().oneMinus().pow(2)
    this.colorNode = mix(body, color(style.crushed), light.smoothstep(0.45, 1)).mul(slant.mul(1.4).add(1))
    // Flattened fibers lie smooth enough for a silky luster, and scatter more sheen.
    this.roughnessNode = float(0.88).sub(crush.mul(0.3))
    this.sheenNode = color(style.sheen).mul(crush.mul(0.45).add(pressed.mul(0.3)).add(0.25).mul(fibers.mul(0.4).add(0.8)))
    this.sheenRoughnessNode = float(0.5).sub(crush.mul(0.12))
    // The pile leans differently in every crushed patch, and the strokes, the nap and the clumps ripple its surface.
    const height = crush.mul(0.002)
      .add(pressed.mul(0.0003).mul(relief(1 / 90)))
      .add(nap.mul(0.00035).mul(relief(1 / 34)))
      .add(clumps.mul(0.0004).mul(relief(1 / 25)))
      .add(tufts.mul(0.0002).mul(relief(1 / 60)))
      .add(fibers.mul(0.0001).mul(relief(1 / 170)))
    this.normalNode = heightNormal(height)
  }
}
