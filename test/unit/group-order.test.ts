import {expect, test} from 'bun:test'

import {Group, Mesh, Object3D} from 'three/webgpu'

import setGroupOrder from '../../src/lib/rendering/groupOrder.ts'

test('a group order reaches every group under the root, however deep, and leaves the meshes’ own render order alone', () => {
  const root = new Group
  const nested = new Group
  const deeper = new Group
  const holder = new Object3D
  const mesh = new Mesh
  mesh.renderOrder = -1
  deeper.add(mesh)
  holder.add(deeper)
  nested.add(holder)
  root.add(nested)
  const outside = new Group
  setGroupOrder(root, 3)
  expect([root.renderOrder, nested.renderOrder, deeper.renderOrder]).toEqual([3, 3, 3])
  expect(holder.renderOrder).toBe(0)
  expect(mesh.renderOrder).toBe(-1)
  expect(outside.renderOrder).toBe(0)
})
