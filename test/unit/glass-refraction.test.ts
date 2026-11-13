import type CastFloorGlassMaterial from '../../src/lib/materials/CastFloorGlassMaterial.ts'
import type CrownGlassMaterial from '../../src/lib/materials/CrownGlassMaterial.ts'
import type {NodeFrame, RenderTarget, ViewportTextureNode} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'

import {BoxGeometry, Matrix4, Mesh, NodeUpdateType, PerspectiveCamera, Quaternion, SphereGeometry, Vector3} from 'three/webgpu'

import {floorGlassThickness} from '../../src/lib/gallery/floors.ts'
import {salonWindow} from '../../src/lib/gallery/lobbyWindows.ts'
import {createArchitecturalGlassMaterials, disposeArchitecturalGlassMaterials} from '../../src/lib/materials/ArchitecturalGlassMaterials.ts'
import {liveViewportDepthTexture, liveViewportMipTexture, liveViewportTexture} from '../../src/lib/materials/liveViewport.ts'
import GalleryDrawingPipeline from '../../src/lib/rendering/GalleryDrawingPipeline.ts'
import ClearOrbMaterial from '../../src/orbs/transparent/ClearOrbMaterial.ts'

type TransparentItem = {
  geometry: BoxGeometry | SphereGeometry
  groupOrder: number
  id: number
  object: Mesh
  renderOrder: number
  z: number
}

const basis = new Matrix4
basis.makeBasis(new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0))
const upright = new Quaternion
upright.setFromRotationMatrix(basis)
function createLobbyWindowMesh() {
  const geometry = new BoxGeometry(salonWindow.width, salonWindow.thickness, salonWindow.top - salonWindow.bottom)
  geometry.translate(salonWindow.width / 2, 0, (salonWindow.top - salonWindow.bottom) / 2)
  geometry.computeBoundingSphere()
  const mesh = new Mesh(geometry)
  mesh.position.set(salonWindow.x, salonWindow.bottom, salonWindow.z - salonWindow.width / 2)
  mesh.quaternion.copy(upright)
  mesh.userData = {glassPlane: [0, 1, 0] as const}
  mesh.updateMatrixWorld(true)
  return mesh
}
function createFloorGlassMesh() {
  const geometry = new BoxGeometry(8, floorGlassThickness, 8)
  geometry.computeBoundingSphere()
  const mesh = new Mesh(geometry)
  mesh.position.set(0, -floorGlassThickness / 2, -24)
  mesh.userData = {glassPlane: [0, 1, 0] as const}
  mesh.updateMatrixWorld(true)
  return mesh
}
function createOrbMesh(x: number, y: number, z: number) {
  const geometry = new SphereGeometry(0.14, 16, 12)
  geometry.computeBoundingSphere()
  const mesh = new Mesh(geometry)
  mesh.position.set(x, y, z)
  mesh.updateMatrixWorld(true)
  return mesh
}
function sortTransparent(pipeline: GalleryDrawingPipeline, camera: PerspectiveCamera, meshes: ReadonlyArray<Mesh>) {
  const projScreen = new Matrix4
  projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  const items: Array<TransparentItem> = meshes.map(mesh => {
    const center = mesh.geometry.boundingSphere!.center.clone()
    center.applyMatrix4(mesh.matrixWorld).applyMatrix4(projScreen)
    return {
      geometry: mesh.geometry as BoxGeometry | SphereGeometry,
      groupOrder: 0,
      id: mesh.id,
      object: mesh,
      renderOrder: mesh.renderOrder,
      z: center.z,
    }
  })
  const renderList = {
    finish: () => {},
    transparent: items,
  }
  pipeline.finishRenderList(renderList)
  items.sort((a, b) => {
    if (a.groupOrder !== b.groupOrder) {
      return a.groupOrder - b.groupOrder
    }
    if (a.renderOrder !== b.renderOrder) {
      return a.renderOrder - b.renderOrder
    }
    if (a.z !== b.z) {
      return b.z - a.z
    }
    return a.id - b.id
  })
  return items.map(item => item.object)
}
describe('live viewport copies', () => {
  test('sample clones inherit per-object updates and mipmap settings', () => {
    const sharp = liveViewportTexture() as ViewportTextureNode
    const mip = liveViewportMipTexture() as ViewportTextureNode
    const depth = liveViewportDepthTexture() as ViewportTextureNode
    expect(sharp.updateBeforeType).toBe(NodeUpdateType.OBJECT)
    expect(mip.updateBeforeType).toBe(NodeUpdateType.OBJECT)
    expect(depth.updateBeforeType).toBe(NodeUpdateType.OBJECT)
    expect(sharp.generateMipmaps).toBe(false)
    expect(mip.generateMipmaps).toBe(true)
  })
  test('copies the framebuffer once per drawn object and refreshes for subsequent objects', () => {
    const a = liveViewportMipTexture()
    const b = liveViewportMipTexture()
    const depthA = liveViewportDepthTexture()
    const depthB = liveViewportDepthTexture()
    const firstMesh = new Mesh
    const secondMesh = new Mesh
    const calls: Array<unknown> = []
    const target = {
      width: 640,
      height: 360,
    } as RenderTarget
    const renderer = {
      info: {calls: 1},
      getRenderTarget: () => target,
      getCanvasTarget: () => null,
      copyFramebufferToTexture: (texture: unknown) => {
        calls.push(texture)
      },
    }
    const makeFrame = (object: Mesh, renderId = 1, callCount = 1) => {
      renderer.info.calls = callCount
      return {
        object,
        renderId,
        renderer,
      } as unknown as NodeFrame
    }
    for (const node of [a, b, depthA, depthB]) {
      const frame = makeFrame(firstMesh)
      node.updateReference(frame)
      node.updateBefore(frame)
    }
    expect(calls).toHaveLength(2)
    for (const node of [a, b, depthA, depthB]) {
      const frame = makeFrame(secondMesh)
      node.updateReference(frame)
      node.updateBefore(frame)
    }
    expect(calls).toHaveLength(4)
    // A new render call on the same mesh copies again even if the mesh pointer did not change.
    a.updateReference(makeFrame(secondMesh, 2, 2))
    a.updateBefore(makeFrame(secondMesh, 2, 2))
    expect(calls).toHaveLength(5)
  })
  test('refraction materials copy the live framebuffer instead of the opaque-only snapshot', () => {
    const materials = createArchitecturalGlassMaterials(true)
    const lobbyWindow = materials.lobbyWindow as CastFloorGlassMaterial
    const cabin = materials.cabin as CrownGlassMaterial
    const orb = new ClearOrbMaterial({radius: 0.14})
    expect(lobbyWindow.depthWrite).toBe(true)
    expect(lobbyWindow.emissiveNode).not.toBeNull()
    expect(cabin.emissiveNode).not.toBeNull()
    expect(orb.emissiveNode).not.toBeNull()
    orb.dispose()
    disposeArchitecturalGlassMaterials(materials)
  })
})
describe('transparent sorting around planar glass', () => {
  test('orders an oblique orb behind the Salon window before the window, and a held orb in front after it', () => {
    const camera = new PerspectiveCamera(62, 16 / 9, 0.1, 1000)
    camera.position.set(6.5, 1.6, -27.5)
    camera.lookAt(8.5, 1.6, -26.5)
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()
    const windowMesh = createLobbyWindowMesh()
    const behindOrb = createOrbMesh(8.5, 1.6, -26.5)
    const inFrontOrb = createOrbMesh(7.8, 1.6, -22)
    const marker = createOrbMesh(8.5, 1.6, -26.5)
    marker.renderOrder = 10
    const pipeline = new GalleryDrawingPipeline
    pipeline.begin(camera, {})
    const projScreen = new Matrix4
    projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const zOf = (mesh: Mesh) => {
      const center = mesh.geometry.boundingSphere!.center.clone()
      return center.applyMatrix4(mesh.matrixWorld).applyMatrix4(projScreen).z
    }
    // Standard bounding-sphere z makes the wide window look farther than the orb near its north end.
    expect(zOf(windowMesh)).toBeGreaterThan(zOf(behindOrb))
    expect(sortTransparent(pipeline, camera, [windowMesh, behindOrb, inFrontOrb, marker])).toEqual([behindOrb, windowMesh, inFrontOrb, marker])
    windowMesh.geometry.dispose()
    behindOrb.geometry.dispose()
    inFrontOrb.geometry.dispose()
    marker.geometry.dispose()
  })
  test('orders an orb below the Lobby floor glass before the glass even at oblique angles', () => {
    const camera = new PerspectiveCamera(62, 16 / 9, 0.1, 1000)
    camera.position.set(0, 1.6, -29)
    camera.lookAt(0, -2, -27)
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()
    const floorMesh = createFloorGlassMesh()
    const oculusOrb = createOrbMesh(0, -3, -27.5)
    const lobbyOrb = createOrbMesh(0, 0.5, -22)
    const pipeline = new GalleryDrawingPipeline
    pipeline.begin(camera, {})
    expect(sortTransparent(pipeline, camera, [floorMesh, oculusOrb, lobbyOrb])).toEqual([oculusOrb, floorMesh, lobbyOrb])
    floorMesh.geometry.dispose()
    oculusOrb.geometry.dispose()
    lobbyOrb.geometry.dispose()
  })
})
