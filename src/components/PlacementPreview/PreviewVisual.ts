import type {Texture} from 'three/webgpu'

import {clamp} from 'math'
import hsl from 'okhsl'
import {float, Fn, fwidth, luminance, max, mix, sin, smoothstep, texture, uniform, uv, vec2} from 'three/tsl'
import {BufferGeometry, Color, Float32BufferAttribute, MeshBasicNodeMaterial} from 'three/webgpu'

import portraitLabel, {portraitLabelLayout} from '#src/lib/gallery/portraitLabel.ts'

export const previewColors = {
  valid: hsl.integer(148, 100, 85.7),
  invalid: hsl.integer(24, 100, 60),
}
export const previewOpacity = (inReach: boolean) => (inReach ? 1 : 0.18)

/** A closed ribbon whose U coordinate measures distance around the frame. */
export function previewBorderGeometry(width: number, height: number, thickness = 0.028) {
  const x = width / 2
  const y = height / 2
  const corners = [[-x, -y], [x, -y], [x, y], [-x, y], [-x, -y]] as const
  const distances = [0, width, width + height, 2 * width + height, 2 * (width + height)]
  const positions: Array<number> = []
  const uvs: Array<number> = []
  const indices: Array<number> = []
  for (const [index, [cx, cy]] of corners.entries()) {
    positions.push(cx, cy, 0, cx - Math.sign(cx) * thickness, cy - Math.sign(cy) * thickness, 0)
    uvs.push(distances[index], 0, distances[index], 1)
    if (index >= 4) {
      continue
    }
    const i = index * 2
    indices.push(i, i + 2, i + 1, i + 2, i + 3, i + 1)
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export default class PreviewVisual {
  readonly border: BufferGeometry
  readonly borderMaterial: MeshBasicNodeMaterial
  readonly imageMaterial = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  })
  readonly labelBorder: BufferGeometry
  readonly labelBorderMaterial: MeshBasicNodeMaterial
  readonly opacity = uniform(1)
  readonly time = uniform(0)
  readonly tint = uniform(new Color)

  /** The preview of a `width` × `height` work in a frame reaching `reach` out past its edges, which the border runs 2 cm outside of. */
  constructor(width: number, height: number, reach: number, artwork: Texture<{
    height: number
    width: number
  }> | null) {
    const outerWidth = width + reach * 2 + 0.04
    const outerHeight = height + reach * 2 + 0.04
    this.border = previewBorderGeometry(outerWidth, outerHeight)
    const label = portraitLabelLayout(width, height)
    this.labelBorder = previewBorderGeometry(label.width, portraitLabel.height, 0.012)
    this.borderMaterial = this.createBorderMaterial(outerWidth, outerHeight)
    this.labelBorderMaterial = this.createBorderMaterial(label.width, portraitLabel.height)
    const scan = sin(uv().y.mul(height * 320)).mul(0.025).add(0.975)
    let edges: ReturnType<typeof luminance> = float(0)
    if (artwork) {
      const image = texture(artwork)
      // Keep contours readable at a distance without depending on the source resolution.
      const texel = max(vec2(1 / artwork.image.width, 1 / artwork.image.height), fwidth(uv()).mul(1.15))
      edges = Fn(() => {
        const sample = (x: number, y: number) => luminance(image.sample(uv().add(texel.mul(vec2(x, y)))).rgb).toVar()
        const a = sample(-1, -1)
        const b = sample(0, -1)
        const c = sample(1, -1)
        const d = sample(-1, 0)
        const f = sample(1, 0)
        const g = sample(-1, 1)
        const h = sample(0, 1)
        const i = sample(1, 1)
        const gx = c.add(f.mul(2)).add(i).sub(a.add(d.mul(2)).add(g))
        const gy = g.add(h.mul(2)).add(i).sub(a.add(b.mul(2)).add(c))
        return smoothstep(0.035, 0.65, vec2(gx, gy).length())
      })()
    }
    this.imageMaterial.colorNode = this.tint.mul(edges.mul(1.15).add(0.025)).mul(scan)
    this.imageMaterial.opacityNode = edges.mul(0.3).add(0.65).mul(this.opacity)
    this.update(false, 0)
  }

  dispose() {
    this.border.dispose()
    this.labelBorder.dispose()
    this.borderMaterial.dispose()
    this.labelBorderMaterial.dispose()
    this.imageMaterial.dispose()
  }

  update(fits: boolean, delta: number, inReach = true) {
    this.tint.value.set(fits ? previewColors.valid : previewColors.invalid)
    this.opacity.value = previewOpacity(inReach)
    this.time.value = (this.time.value + clamp(delta, 0, 0.06)) % 1024
  }

  private createBorderMaterial(width: number, height: number) {
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    })
    // An integer number of dashes closes the loop without a jump at the seam.
    const perimeter = 2 * (width + height)
    const cycles = Math.max(1, Math.round(perimeter / 0.18))
    const phase = uv().x.mul(cycles / perimeter).sub(this.time.mul(1.5)).mul(2 * Math.PI)
    const wave = sin(phase)
    const antialias = max(fwidth(phase), 0.015)
    const dash = smoothstep(antialias.negate(), antialias, wave)
    material.colorNode = this.tint.mul(mix(0.1, 1.35, dash))
    material.opacityNode = mix(0.45, 0.98, dash).mul(this.opacity)
    return material
  }
}
