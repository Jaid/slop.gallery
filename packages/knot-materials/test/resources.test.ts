import {expect, test} from 'bun:test'

import KnotResources from '../src/KnotResources.ts'
import {knotsById} from '../src/main.ts'

test('shares culling geometry by displacement bound and reuses one tight collider surface', () => {
  const base = knotsById.get('lenticular_mirage')!
  const relief = knotsById.get('coralline_crown')!
  const resources = new KnotResources([
    base,
    {
      ...base,
      id: 'second',
    },
    relief,
    {
      ...relief,
      id: 'another_relief',
    },
  ])
  const [a, b, c, d] = resources.items
  try {
    expect(a.geometry).toBe(b.geometry)
    expect(c.geometry).toBe(d.geometry)
    expect(a.geometry).not.toBe(c.geometry)
    expect(a.geometry.getAttribute('position').array).toEqual(c.geometry.getAttribute('position').array)
    expect(a.colliderVertices).toBe(b.colliderVertices)
    expect(a.colliderVertices).toBe(c.colliderVertices)
    expect(a.colliderVertices).toBe(d.colliderVertices)
    expect([...a.colliderVertices]).toEqual([...a.geometry.getAttribute('position').array])
    expect(c.geometry.boundingSphere!.radius - a.geometry.boundingSphere!.radius).toBeCloseTo(relief.displacement!, 8)
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(a.geometry.boundingBox!.min[axis] - c.geometry.boundingBox!.min[axis]).toBeCloseTo(relief.displacement!, 8)
      expect(c.geometry.boundingBox!.max[axis] - a.geometry.boundingBox!.max[axis]).toBeCloseTo(relief.displacement!, 8)
    }
  } finally {
    resources.dispose()
  }
})
test('disposes each shared geometry resource once', () => {
  const base = knotsById.get('lenticular_mirage')!
  const relief = knotsById.get('coralline_crown')!
  const resources = new KnotResources([
    base,
    {
      ...base,
      id: 'second',
    },
    relief,
    {
      ...relief,
      id: 'another_relief',
    },
  ])
  const geometries = new Set(resources.items.map(item => item.geometry))
  let disposals = 0
  for (const geometry of geometries) {
    geometry.addEventListener('dispose', () => disposals++)
  }
  resources.dispose()
  expect(disposals).toBe(geometries.size)
})
