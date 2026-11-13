import type {ViewportTextureNode} from 'three/webgpu'

import {expect, spyOn, test} from 'bun:test'

import {vec2, viewportDepthTexture, viewportOpaqueMipTexture} from 'three/tsl'
import {MeshBasicNodeMaterial, NodeUpdateType, RenderTarget} from 'three/webgpu'

import GlassBackdrop from '../../src/lib/rendering/GlassBackdrop.ts'

test('glass owns color and depth separate from the opaque-only snapshots, refreshing once per draw rather than per sample', () => {
  const material = new MeshBasicNodeMaterial
  const backdrop = GlassBackdrop.forMaterial(material)
  try {
    expect(backdrop.color.updateBeforeType).toBe(NodeUpdateType.OBJECT)
    expect(backdrop.depth.updateBeforeType).toBe(NodeUpdateType.OBJECT)
    expect(backdrop.color.generateMipmaps).toBe(false)
    expect(backdrop.depth.generateMipmaps).toBe(false)
    expect(backdrop.color.value).not.toBe((viewportOpaqueMipTexture() as ViewportTextureNode).value)
    expect(backdrop.depth.value).not.toBe(viewportDepthTexture().value)
    expect(backdrop.color.value).not.toBe(backdrop.depth.value)
    for (const root of [backdrop.color, backdrop.depth]) {
      const sample = root.sample(vec2(0.25, 0.75))
      expect(sample.referenceNode).toBe(root)
      expect(sample.value).toBe(root.value)
      // The root is built as the sample’s reference node and is the only node that copies the framebuffer.
      expect(sample.updateBeforeType).toBe(NodeUpdateType.NONE)
    }
  } finally {
    material.dispose()
  }
})
test('panes share scratch textures, but camera and reflection targets never share their copies', () => {
  const materials = [new MeshBasicNodeMaterial, new MeshBasicNodeMaterial]
  const main = new RenderTarget(256, 128)
  const reflection = new RenderTarget(128, 64)
  const backdrop = GlassBackdrop.forMaterial(materials[0])
  const other = GlassBackdrop.forMaterial(materials[1])
  try {
    expect(other).toBe(backdrop)
    for (const root of [backdrop.color, backdrop.depth]) {
      const first = root.getTextureForReference(main)
      expect(root.getTextureForReference(main)).toBe(first)
      expect(other.color.getTextureForReference(main)).toBe(backdrop.color.getTextureForReference(main))
      expect(root.getTextureForReference(reflection)).not.toBe(first)
      expect(root.getTextureForReference()).not.toBe(first)
    }
  } finally {
    for (const material of materials) {
      material.dispose()
    }
    main.dispose()
    reflection.dispose()
  }
})
test('disposing the last pane releases every target’s color and depth exactly once, and a later glass mode starts fresh', () => {
  const first = new MeshBasicNodeMaterial
  const second = new MeshBasicNodeMaterial
  const target = new RenderTarget(32, 32)
  const backdrop = GlassBackdrop.forMaterial(first)
  GlassBackdrop.forMaterial(second)
  const disposals = [backdrop.color, backdrop.depth].flatMap(root => [root.getTextureForReference(), root.getTextureForReference(target)]).map(texture => spyOn(texture, 'dispose'))
  first.dispose()
  first.dispose()
  for (const dispose of disposals) {
    expect(dispose).not.toHaveBeenCalled()
  }
  second.dispose()
  second.dispose()
  for (const dispose of disposals) {
    expect(dispose).toHaveBeenCalledTimes(1)
  }
  const later = new MeshBasicNodeMaterial
  expect(GlassBackdrop.forMaterial(later)).not.toBe(backdrop)
  later.dispose()
  target.dispose()
})
test('replaced and resized render targets release their scratch copies while the glass remains mounted', () => {
  const material = new MeshBasicNodeMaterial
  const backdrop = GlassBackdrop.forMaterial(material)
  // Multiple shader helpers asking for the same material do not retain it twice.
  expect(GlassBackdrop.forMaterial(material)).toBe(backdrop)
  const target = new RenderTarget(32, 32)
  const other = new RenderTarget(16, 16)
  const copies = [backdrop.color, backdrop.depth].map(root => root.getTextureForReference(target))
  const targetDisposals = copies.map(texture => spyOn(texture, 'dispose'))
  const otherDisposals = [backdrop.color, backdrop.depth].map(root => spyOn(root.getTextureForReference(other), 'dispose'))
  // Sample nodes borrow textures from their root and must never dispose them.
  backdrop.color.sample(vec2(0.5)).dispose()
  target.setSize(64, 64)
  for (const dispose of targetDisposals) {
    expect(dispose).toHaveBeenCalledTimes(1)
  }
  for (const dispose of otherDisposals) {
    expect(dispose).not.toHaveBeenCalled()
  }
  // Three keeps its cached Texture objects, whose GPU allocations are recreated on the next draw.
  for (const [index, root] of [backdrop.color, backdrop.depth].entries()) {
    expect(root.getTextureForReference(target)).toBe(copies[index])
  }
  target.dispose()
  for (const dispose of targetDisposals) {
    expect(dispose).toHaveBeenCalledTimes(2)
  }
  material.dispose()
  for (const dispose of otherDisposals) {
    expect(dispose).toHaveBeenCalledTimes(1)
  }
  for (const dispose of targetDisposals) {
    expect(dispose).toHaveBeenCalledTimes(2)
  }
  other.dispose()
})
