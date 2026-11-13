import type {ThreeElements} from '@react-three/fiber'
import type {Group, Material} from 'three/webgpu'

import {useLayoutEffect, useRef} from 'react'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {BufferAttribute, BufferGeometry, Matrix4, Mesh} from 'three/webgpu'

import {isRefractingPane} from '#src/lib/rendering/refractingPanes.ts'

type Family = {
  material: Material
  meshes: Array<Mesh>
}

/** material properties that decide how a plain material shades; materials with node overrides only batch with themselves */
const shadingKeys = ['type', 'color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'opacity', 'transparent', 'side', 'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'alphaTest', 'toneMapped', 'envMapIntensity', 'depthWrite', 'depthTest', 'vertexColors', 'flatShading', 'fog', 'wireframe'] as const
const nodeKeys = ['colorNode', 'normalNode', 'roughnessNode', 'metalnessNode', 'emissiveNode', 'opacityNode', 'positionNode', 'outputNode', 'fragmentNode', 'vertexNode', 'mrtNode', 'castShadowNode', 'maskNode', 'aoNode', 'lightsNode', 'envNode', 'backdropNode'] as const
const sharedAttributes = ['position', 'normal', 'uv'] as const
const relative = new Matrix4
const inverse = new Matrix4
/** a key that equally shading materials share, so meshes with their own copy of the same inline material still batch */
const shadingKey = (material: Material) => {
  const fields = material as unknown as Record<string, unknown>
  if (nodeKeys.some(key => fields[key])) {
    return material.uuid
  }
  return shadingKeys.map(key => {
    const value = fields[key]
    if (typeof value !== 'object' || value === null) {
      // Undefined stays undefined, which join() writes as an empty field.
      return JSON.stringify(value)
    }
    const {getHexString, isTexture, uuid} = value as {
      getHexString?: () => string
      isTexture?: boolean
      uuid?: string
    }
    if (getHexString) {
      return getHexString.call(value)
    }
    return isTexture ? uuid : ''
  }).join('|')
}
/** whether the mesh can merge with others: a plain, visible mesh without its own draw logic */
const batchable = (mesh: Mesh, root: Group) => {
  if (!(mesh as Partial<Mesh>).isMesh || Array.isArray(mesh.material) || 'isInstancedMesh' in mesh || 'isBatchedMesh' in mesh || 'isSkinnedMesh' in mesh || mesh.morphTargetInfluences || !('position' in mesh.geometry.attributes)) {
    return false
  }
  // A mirrored transform would turn the merged faces inside out, an own render hook expects to draw alone and a refracting pane is ordered by its own plane.
  if (mesh.matrixWorld.determinant() <= 0 || mesh.onBeforeRender !== Mesh.prototype.onBeforeRender || isRefractingPane(mesh)) {
    return false
  }
  for (let node: Mesh['parent'] = mesh; node && node !== root; node = node.parent) {
    if (!node.visible) {
      return false
    }
  }
  return mesh.frustumCulled && mesh.layers.mask === 1
}
/** the geometry in the batch’s space, with the attributes all members share and an index */
const placed = (mesh: Mesh) => {
  // Copied into a plain geometry, since clone() calls the subclass constructor, which procedural geometries need arguments for.
  const geometry = new BufferGeometry
  geometry.copy(mesh.geometry)
  for (const name of Object.keys(geometry.attributes)) {
    if (!(sharedAttributes as ReadonlyArray<string>).includes(name)) {
      geometry.deleteAttribute(name)
    }
  }
  geometry.morphAttributes = {}
  // With a single material, a mesh draws its whole geometry whatever groups it lists, as primitives like boxes do.
  geometry.clearGroups()
  if (!geometry.index) {
    const count = geometry.getAttribute('position').count
    const index = Array.from({length: count}, (_, i) => i)
    geometry.setIndex(new BufferAttribute(count > 65_535 ? Uint32Array.from(index) : Uint16Array.from(index), 1))
  }
  return geometry.applyMatrix4(relative.multiplyMatrices(inverse, mesh.matrixWorld))
}

/**
 * Merges the meshes below it that shade alike and cast and receive shadows alike into one mesh each, once they have mounted, so a family of trims or panels costs one draw call instead of one per piece.
 * Only for decor that never moves and never gets looked up. The merged copy is rebuilt whenever the children render anew, like when the graphics mode swaps their materials, but doesn’t follow changes made to the meshes directly. The originals stay in the scene graph for colliders and raycasts but stop rendering. A `RigidBody` below it needs explicit colliders: automatic ones only consider visible meshes and are built after the originals are hidden.
 */
export default function StaticBatch({children, ...props}: ThreeElements['group']) {
  const ref = useRef<Group>(null)
  useLayoutEffect(() => {
    const root = ref.current!
    root.updateWorldMatrix(true, true)
    inverse.copy(root.matrixWorld).invert()
    const families = new Map<string, Family>
    root.traverse(object => {
      const mesh = object as Mesh
      if (!batchable(mesh, root)) {
        return
      }
      const material = mesh.material as Material
      const key = `${shadingKey(material)}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}|${sharedAttributes.filter(name => name in mesh.geometry.attributes).join()}`
      const family = families.get(key)
      if (family) {
        family.meshes.push(mesh)
      } else {
        families.set(key, {
          material,
          meshes: [mesh],
        })
      }
    })
    const batches: Array<Mesh> = []
    for (const {material, meshes} of families.values()) {
      if (meshes.length < 2) {
        continue
      }
      const parts = meshes.map(placed)
      // Null when the parts don’t share their attributes after all.
      const geometry = mergeGeometries(parts) as BufferGeometry | null
      for (const part of parts) {
        part.dispose()
      }
      if (!geometry) {
        continue
      }
      const batch = new Mesh(geometry, material)
      batch.name = `${root.name || 'static'}-batch`
      batch.castShadow = meshes[0].castShadow
      batch.receiveShadow = meshes[0].receiveShadow
      batch.renderOrder = meshes[0].renderOrder
      for (const mesh of meshes) {
        mesh.visible = false
      }
      batch.userData.batched = meshes
      batches.push(batch)
      root.add(batch)
    }
    return () => {
      for (const batch of batches) {
        root.remove(batch)
        batch.geometry.dispose()
        for (const mesh of batch.userData.batched as Array<Mesh>) {
          mesh.visible = true
        }
      }
    }
  }, [children])
  return <group ref={ref} {...props}>{children}</group>
}
