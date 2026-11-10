import type {Mesh} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'

import {MeshPhysicalNodeMaterial, Texture} from 'three/webgpu'

import createKnotMesh from '../src/createKnotMesh.ts'
import Prince from '../src/entries/knotty_prince/Material.ts'
import {createKnotGeometry} from '../src/geometry.ts'

describe('Knotty Prince solid felt underneath fuzz', () => {
  test('preserves sculpt and appearance graphs while giving the felt core a closed, independently displaced surface', () => {
    const environment = new Texture
    const material = new Prince(environment)
    let environmentDisposals = 0
    let coreDisposals = 0
    environment.addEventListener('dispose', () => environmentDisposals++)
    const core = material.coreMaterial!
    core.addEventListener('dispose', () => coreDisposals++)
    try {
      expect(core).toBeInstanceOf(MeshPhysicalNodeMaterial)
      expect(core.envMap).toBe(environment)
      expect(core.positionNode?.isNode).toBe(true)
      expect(core.positionNode).not.toBe(material.positionNode)
      expect(core.opacityNode).not.toBe(material.opacityNode)
      expect(core.alphaTest).toBe(0)
      expect(core.alphaToCoverage).toBe(false)
      expect(material.alphaTest).toBe(0.5)
      expect(material.alphaToCoverage).toBe(true)
      for (const property of ['colorNode', 'normalNode', 'roughnessNode', 'aoNode', 'emissiveNode', 'clearcoatNode', 'sheenNode'] as const) {
        expect(core[property]).toBe(material[property])
      }
    } finally {
      material.dispose()
      expect(coreDisposals).toBe(1)
      expect(environmentDisposals).toBe(0)
      environment.dispose()
    }
  })
  test('shares topology and transforms without duplicating interaction hits', () => {
    const geometry = createKnotGeometry()
    const environment = new Texture
    const material = new Prince(environment)
    const mesh = createKnotMesh(geometry, material)
    try {
      expect(mesh.children).toHaveLength(1)
      const core = mesh.children[0] as Mesh
      expect(core.geometry).toBe(geometry)
      expect(core.material).toBe(material.coreMaterial!)
      mesh.position.set(1, 2, 3)
      mesh.rotation.y = 0.7
      mesh.updateMatrixWorld(true)
      expect(core.matrixWorld.equals(mesh.matrixWorld)).toBe(true)
      const hits: Array<unknown> = []
      core.raycast({} as never, hits as never)
      expect(hits).toHaveLength(0)
    } finally {
      material.dispose()
      geometry.dispose()
      environment.dispose()
    }
  })
  test('ordinary materials still create exactly one mesh', () => {
    const geometry = createKnotGeometry()
    const material = new MeshPhysicalNodeMaterial
    try {
      expect(createKnotMesh(geometry, material).children).toHaveLength(0)
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })
})
