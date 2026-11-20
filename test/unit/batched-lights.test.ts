import type {LightingNode, NodeBuilder} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {DirectionalLight, PointLight, SpotLight} from 'three/webgpu'

import BatchedLightsNode from '../../src/lib/materials/lights/base/BatchedLightsNode.ts'
import PointLightsNode from '../../src/lib/materials/lights/base/PointLightsNode.ts'
import ShiningLightNode from '../../src/lib/materials/lights/base/ShiningLightNode.ts'

/** just enough of a node builder for {@link BatchedLightsNode.setupLightsNode} */
const fakeBuilder = () => {
  const data = new Map<object, object>
  return {
    context: {materialLightings: []},
    getDataFromNode: (node: object) => {
      if (!data.has(node)) {
        data.set(node, {})
      }
      return data.get(node)!
    },
  } as unknown as NodeBuilder
}
const shadowCasting = <Kind extends DirectionalLight | PointLight | SpotLight>(light: Kind) => {
  light.castShadow = true
  return light
}
const lightOf = (node: LightingNode) => (node as LightingNode & {light?: object}).light
test('shadow-casting point and spot lights shade last, through a node that skips them while dark, every other light as before', () => {
  const slot = shadowCasting(new PointLight)
  const sun = shadowCasting(new DirectionalLight)
  const spot = shadowCasting(new SpotLight)
  const lamp = new PointLight
  const lights = new BatchedLightsNode
  lights.setLights([slot, sun, spot, lamp])
  const nodes = lights.setupLightsNode(fakeBuilder())
  expect(nodes).toHaveLength(4)
  expect(lightOf(nodes[0])).toBe(sun)
  expect(nodes[0]).not.toBeInstanceOf(ShiningLightNode)
  // The shadowless lamp is shaded by the batch.
  expect(nodes[1]).toBeInstanceOf(PointLightsNode)
  expect(nodes.slice(2).map(node => (node as ShiningLightNode).lightNode.light)).toEqual([slot, spot])
})
test('a light keeps its wrapper across builds and lights nodes, so materials share its build', () => {
  const slot = shadowCasting(new PointLight)
  const first = new BatchedLightsNode
  first.setLights([slot])
  const second = new BatchedLightsNode
  second.setLights([slot])
  const [wrapper] = first.setupLightsNode(fakeBuilder())
  expect(first.setupLightsNode(fakeBuilder())[0]).toBe(wrapper)
  expect(second.setupLightsNode(fakeBuilder())[0]).toBe(wrapper)
})
test('the wrapper has a hash of its own, or three would build it in place of the light node it wraps', () => {
  const slot = shadowCasting(new PointLight)
  const lights = new BatchedLightsNode
  lights.setLights([slot])
  const builder = fakeBuilder()
  const [wrapper] = lights.setupLightsNode(builder) as Array<ShiningLightNode>
  expect(wrapper.getHash(builder)).not.toBe(wrapper.lightNode.getHash(builder))
})
