import type {Color} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'

import {DataTexture, Vector3} from 'three/webgpu'

import PreviewVisual, {previewBorderGeometry, previewOpacity} from '../../src/components/PlacementPreview/PreviewVisual.ts'
import portraitLabel, {portraitLabelLayout} from '../../src/lib/gallery/portraitLabel.ts'

/** whether the tint reads red, as where a work can’t go, or green */
const red = ({r, g, b}: Color) => r > 2 * g && r > 2 * b
const green = ({r, g, b}: Color) => g > 2 * r && g > 2 * b
describe('placement preview', () => {
  for (const [width, height] of [[2.62, 2.62], [4.22, 1.22], [0.52, 3.22]] as const) {
    test(`the ${width} × ${height} border is closed, hollow and front-facing`, () => {
      const geometry = previewBorderGeometry(width, height)
      try {
        const positions = geometry.getAttribute('position')
        const uvs = geometry.getAttribute('uv')
        const indices = geometry.index!
        expect(positions.count).toBe(10)
        expect(indices.count).toBe(24)
        for (const offset of [0, 1]) {
          const openingVertex = new Vector3
          const closingVertex = new Vector3
          expect(openingVertex.fromBufferAttribute(positions, offset)).toEqual(closingVertex.fromBufferAttribute(positions, 8 + offset))
          expect(uvs.getX(8 + offset)).toBeCloseTo(2 * (width + height))
        }
        let area = 0
        for (let i = 0; i < indices.count; i += 3) {
          const a = new Vector3
          a.fromBufferAttribute(positions, indices.getX(i))
          const b = new Vector3
          b.fromBufferAttribute(positions, indices.getX(i + 1))
          const c = new Vector3
          c.fromBufferAttribute(positions, indices.getX(i + 2))
          const normal = b.sub(a).cross(c.sub(a))
          expect(normal.z).toBeGreaterThan(0)
          area += normal.z / 2
        }
        expect(area).toBeCloseTo(width * height - (width - 0.056) * (height - 0.056), 5)
      } finally {
        geometry.dispose()
      }
    })
  }
  test('validity changes the shared tint while the ants keep animating', () => {
    const visual = new PreviewVisual(2.4, 1.8, 0.09, null)
    try {
      expect(red(visual.tint.value)).toBe(true)
      visual.update(true, 1 / 60)
      expect(green(visual.tint.value)).toBe(true)
      const time = visual.time.value
      visual.update(false, 5)
      expect(visual.time.value - time).toBeCloseTo(0.06)
      expect(red(visual.tint.value)).toBe(true)
      visual.update(true, 5)
      expect(visual.time.value - time).toBeCloseTo(0.12)
      visual.update(true, -1)
      expect(visual.time.value - time).toBeCloseTo(0.12)
      expect(visual.borderMaterial.depthWrite).toBe(false)
      expect(visual.imageMaterial.depthWrite).toBe(false)
      expect(visual.imageMaterial.colorNode).not.toBeNull()
    } finally {
      visual.dispose()
    }
  })
  test('distant previews fade every shader layer without disappearing', () => {
    const visual = new PreviewVisual(2, 2, 0.09, null)
    try {
      visual.update(false, 1 / 60, false)
      expect(visual.opacity.value).toBeGreaterThan(0)
      expect(visual.opacity.value).toBeLessThan(0.5)
      expect(previewOpacity(false)).toBe(visual.opacity.value)
      expect(visual.borderMaterial.opacityNode).not.toBeNull()
      expect(visual.labelBorderMaterial.opacityNode).not.toBeNull()
      expect(visual.imageMaterial.opacityNode).not.toBeNull()
      visual.update(false, 0, true)
      expect(visual.opacity.value).toBe(1)
      expect(red(visual.tint.value)).toBe(true)
    } finally {
      visual.dispose()
    }
  })
  test('the preview sign outline matches the hung label dimensions and bottom', () => {
    for (const width of [0.3, 1.2, 2.4, 4]) {
      const visual = new PreviewVisual(width, 2.4, 0.09, null)
      try {
        const label = portraitLabelLayout(width, 2.4)
        visual.labelBorder.computeBoundingBox()
        const bounds = visual.labelBorder.boundingBox!
        expect(bounds.max.x - bounds.min.x).toBeCloseTo(label.width)
        expect(bounds.max.y - bounds.min.y).toBeCloseTo(portraitLabel.height)
        expect(bounds.min.y + label.y).toBeCloseTo(label.bottom)
        expect(label.titleWidth).toBeLessThanOrEqual(label.width)
        expect(label.creatorWidth).toBeLessThanOrEqual(label.width)
      } finally {
        visual.dispose()
      }
    }
  })
  test('the border runs 2 cm outside of the frame', () => {
    for (const reach of [0.026, 0.09, 0.148]) {
      const visual = new PreviewVisual(1.2, 0.8, reach, null)
      try {
        visual.border.computeBoundingBox()
        const bounds = visual.border.boundingBox!
        expect(bounds.max.x - bounds.min.x).toBeCloseTo(1.2 + reach * 2 + 0.04)
        expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.8 + reach * 2 + 0.04)
      } finally {
        visual.dispose()
      }
    }
  })
  test('disposes its own resources without disposing the shared artwork texture', () => {
    const texture = new DataTexture(new Uint8Array(16), 2, 2)
    const visual = new PreviewVisual(1, 2, 0.09, texture)
    const disposed: Array<string> = []
    visual.border.addEventListener('dispose', () => disposed.push('border'))
    visual.labelBorder.addEventListener('dispose', () => disposed.push('label border'))
    visual.labelBorderMaterial.addEventListener('dispose', () => disposed.push('label border material'))
    visual.borderMaterial.addEventListener('dispose', () => disposed.push('border material'))
    visual.imageMaterial.addEventListener('dispose', () => disposed.push('image material'))
    texture.addEventListener('dispose', () => disposed.push('texture'))
    visual.dispose()
    expect(disposed).toEqual(['border', 'label border', 'border material', 'label border material', 'image material'])
    texture.dispose()
  })
})
