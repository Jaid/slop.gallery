import type {NodeBuilder, NodeMaterial} from 'three/webgpu'

import {expect, spyOn, test} from 'bun:test'

import BloomNode from 'three/addons/tsl/display/BloomNode.js'
import {vec4} from 'three/tsl'

import ConfigurableBloomNode from '#src/lib/rendering/ConfigurableBloomNode.ts'

test('bloom mip count and Gaussian kernel radius control the actual blur passes', () => {
  const prototype = BloomNode.prototype as unknown as {_getSeparableBlurMaterial: (context: unknown, radius: number) => NodeMaterial}
  const createBlur = spyOn(prototype, '_getSeparableBlurMaterial')
  const bloom = new ConfigurableBloomNode(vec4(1), 3, 8)
  try {
    bloom.setResolutionScale(0.25)
    bloom.setup({getSharedContext: () => ({})} as unknown as NodeBuilder)
    const internals = bloom as unknown as {
      _compositeMaterial: NodeMaterial
      _nMips: number
      _separableBlurMaterials: Array<NodeMaterial>
    }
    expect(bloom.getResolutionScale()).toBe(0.25)
    expect(internals._nMips).toBe(3)
    expect(internals._separableBlurMaterials).toHaveLength(3)
    expect(createBlur.mock.calls.map(([, radius]) => radius)).toEqual([8, 12, 16])
    expect(internals._compositeMaterial.fragmentNode).toBeDefined()
  } finally {
    bloom.dispose()
    createBlur.mockRestore()
  }
})
