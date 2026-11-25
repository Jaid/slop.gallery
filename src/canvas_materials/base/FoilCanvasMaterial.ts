import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {texture, uv, vec2, vec3} from 'three/tsl'

import foilAngles from '../lib/foilAngles.ts'
import CanvasMaterial from './CanvasMaterial.ts'

/** The key and viewer’s half-vector in print space, and how directly the key shines on its face. */
export type FoilSurface = CanvasSurface & {
  facing: Node<'float'>
  half: Node<'vec3'>
}

type Separation = {
  color: Node<'vec3'>
  mask: Node<'float'>
}

/** A foil stock whose optical response follows the key light in whatever scene renders it, including detached portrait previews. */
export default abstract class FoilCanvasMaterial extends CanvasMaterial {
  protected abstract coat(material: MeshPhysicalNodeMaterial, surface: FoilSurface): void

  /** Exposes the three RGB plates in perceptual space over a physical patch of ink, filtered to at least the pixel footprint. */
  protected ink({map, uvPerMeter}: FoilSurface, at: Node<'vec2'>, span: number) {
    const area = uvPerMeter.mul(span).max(uv().fwidth())
    return texture(map, at.clamp()).grad(vec2(area.x, 0), vec2(0, area.y)).rgb.sqrt().toVar()
  }

  protected override paint(material: MeshPhysicalNodeMaterial, surface: CanvasSurface) {
    this.coat(material, {
      ...surface,
      ...foilAngles(surface.view),
    })
  }

  /** Mixes the foil exposed through three color separations over the ink, preserving differences in its density even in a flash. */
  protected print(material: MeshPhysicalNodeMaterial, {image, luminance, facing}: FoilSurface, [r, g, b]: [Separation, Separation, Separation], coverage: number, gain: number) {
    const sum = r.mask.add(g.mask).add(b.mask)
    const color = r.color.mul(r.mask).add(g.color.mul(g.mask)).add(b.color.mul(b.mask)).div(sum.max(0.0001))
    const mask = sum.mul(coverage).mul(facing).clamp().toVar('foilMask')
    const stock = luminance.sqrt().mul(0.32).add(0.28)
    material.colorNode = image.mul(mask.mul(-0.26).add(0.97)).add(color.mul(stock).mul(mask).mul(gain))
    material.metalnessNode = mask.mul(0.24)
    material.roughnessNode = mask.mul(-0.36).add(0.68)
    material.clearcoat = 0.22
    material.clearcoatRoughness = 0.28
  }

  /** The color of an optical phase in turns, with smooth peaks between spectral bands. */
  protected spectrum(phase: Node<'float'>) {
    return vec3(0, -0.34, -0.66).add(phase).mul(2 * Math.PI).cos().mul(0.5).add(0.5).pow(1.6).mul(0.94).add(0.06)
  }
}
