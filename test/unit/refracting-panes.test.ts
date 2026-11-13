import type {RenderItem} from '../../src/lib/rendering/refractingPanes.ts'
import type {Object3D} from 'three/webgpu'

import {afterEach, expect, test} from 'bun:test'

import {BoxGeometry, Matrix4, Mesh, MeshBasicNodeMaterial, NodeUpdateType, PerspectiveCamera, Vector3, Vector4} from 'three/webgpu'

import GalleryDrawingPipeline from '../../src/lib/rendering/GalleryDrawingPipeline.ts'
import {GalleryRenderer} from '../../src/lib/rendering/GalleryRenderer.ts'
import {isRefractingPane, paneBackdrop, refractingPaneRef} from '../../src/lib/rendering/refractingPanes.ts'

const material = new MeshBasicNodeMaterial({transparent: true})
const small = new BoxGeometry(0.3, 0.3, 0.3)
/** a pane like the Lobby’s glass walls: 8 m wide and 3 m high, standing in the plane x = 8 with its faces along its local y */
const upright = new Matrix4
upright.makeBasis(new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0))
const createWall = (x = 8) => {
  const mesh = new Mesh(new BoxGeometry(8, 0.12, 3), material)
  mesh.position.set(x, 2.7, -24)
  // Stood up like the Lobby’s glass walls: local x runs along z, local y crosses the wall along x and local z rises.
  mesh.quaternion.setFromRotationMatrix(upright)
  mesh.updateMatrixWorld()
  return mesh
}
const createThing = (x: number, z: number) => {
  const mesh = new Mesh(small, material)
  mesh.position.set(x, 1.5, z)
  mesh.updateMatrixWorld()
  return mesh
}
/** a camera in the Lobby, near the north end of its glass wall to the Salon, looking along it toward the Salon */
const createCamera = (x = 6.3, z = -22.9) => {
  const camera = new PerspectiveCamera(62, 16 / 9, 0.1, 1000)
  camera.position.set(x, 1.62, z)
  camera.lookAt(14, 1.5, -28)
  camera.updateMatrixWorld()
  return camera
}
const projection = new Matrix4
const point = new Vector4
/** the render items three’s projection pushes for the objects, with its clip-space depth of their centers */
const project = (camera: PerspectiveCamera, objects: ReadonlyArray<Mesh>) => {
  projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  return objects.map((object, id): RenderItem => {
    object.geometry.computeBoundingSphere()
    const {x, y, z} = object.geometry.boundingSphere!.center
    point.set(x, y, z, 1).applyMatrix4(object.matrixWorld).applyMatrix4(projection)
    return {
      id,
      object,
      geometry: object.geometry,
      material,
      groupOrder: 0,
      renderOrder: 0,
      z: point.z,
      group: null,
      clippingContext: null,
    }
  })
}
const unregister: Array<() => void> = []
const markPane = (mesh: Object3D) => {
  unregister.push(refractingPaneRef([0, 1, 0])(mesh)!)
}
afterEach(() => {
  for (const release of unregister.splice(0)) {
    release()
  }
})
/** Sorts the items like the renderer: projected through the gallery’s drawing pipeline, then sorted by its pane order. */
const sort = (camera: PerspectiveCamera, objects: ReadonlyArray<Mesh>) => {
  const pipeline = new GalleryDrawingPipeline
  pipeline.begin(camera, {})
  const transparent = project(camera, objects)
  pipeline.finishRenderList({
    finish() {},
    transparent,
  })
  return transparent.toSorted(pipeline.paneOrder.compare).map(item => item.object)
}
test('a Knot behind a glass wall draws before the wall although it is nearer than the wall’s center, and things on the camera’s side after it', () => {
  const wall = createWall()
  markPane(wall)
  // Just beyond the wall’s near end, so its center is nearer to the camera than the wall’s.
  const knot = createThing(9.5, -21)
  const orb = createThing(13.6, -27.8)
  const near = createThing(7, -25)
  const camera = createCamera()
  const [knotItem, wallItem] = project(camera, [knot, wall])
  // three alone would draw the knot after the wall, over it.
  expect(knotItem.z).toBeLessThan(wallItem.z!)
  expect(sort(camera, [wall, near, knot, orb])).toEqual([orb, knot, wall, near])
})
test('unmarked, the wall sorts by distance as three does', () => {
  const wall = createWall()
  const knot = createThing(9.5, -21)
  const orb = createThing(13.6, -27.8)
  const camera = createCamera()
  expect(sort(camera, [wall, knot, orb])).toEqual([orb, wall, knot])
})
test('seen from beyond the wall, the room on the camera’s side of it draws after it and the room behind it before it', () => {
  const wall = createWall()
  markPane(wall)
  const salonThing = createThing(13, -22)
  const lobbyThing = createThing(2, -26)
  const camera = createCamera(15, -24)
  camera.lookAt(0, 1.5, -24)
  camera.updateMatrixWorld()
  expect(sort(camera, [salonThing, wall, lobbyThing])).toEqual([lobbyThing, wall, salonThing])
})
test('a pane seen through another pane draws after what lies behind it and before what lies between them', () => {
  const salonWall = createWall()
  const forgeWall = createWall(-8)
  markPane(salonWall)
  markPane(forgeWall)
  const forgeThing = createThing(-12, -24)
  const lobbyThing = createThing(0, -24)
  const salonThing = createThing(12, -24)
  const camera = createCamera(15, -24)
  camera.lookAt(-20, 1.5, -24)
  camera.updateMatrixWorld()
  expect(sort(camera, [salonThing, salonWall, lobbyThing, forgeWall, forgeThing])).toEqual([forgeThing, forgeWall, lobbyThing, salonWall, salonThing])
})
test('render order and group order still decide within the same side of every pane', () => {
  const wall = createWall()
  markPane(wall)
  const flame = createThing(3, -26)
  const water = createThing(2, -20)
  const camera = createCamera()
  const pipeline = new GalleryDrawingPipeline
  pipeline.begin(camera, {})
  const items = project(camera, [wall, flame, water])
  items[1].renderOrder = 1
  pipeline.finishRenderList({
    finish() {},
    transparent: items,
  })
  expect(items.toSorted(pipeline.paneOrder.compare).map(item => item.object)).toEqual([wall, water, flame])
  items[0].groupOrder = 1
  expect(items.toSorted(pipeline.paneOrder.compare).map(item => item.object)).toEqual([water, flame, wall])
})
test('a pane that unmounts no longer reorders anything', () => {
  const wall = createWall()
  const release = refractingPaneRef([0, 1, 0])(wall)!
  expect(isRefractingPane(wall)).toBe(true)
  release()
  expect(isRefractingPane(wall)).toBe(false)
  expect(refractingPaneRef([0, 1, 0])(null)).toBeUndefined()
})
test('the gallery’s renderer sorts transparent draws by the pane order', () => {
  const renderer = new GalleryRenderer({canvas: {style: {}} as HTMLCanvasElement})
  try {
    const internals = renderer as unknown as {
      _transparentSort: unknown
      drawing: GalleryDrawingPipeline
    }
    expect(internals._transparentSort).toBe(internals.drawing.paneOrder.compare)
  } finally {
    ;(renderer as unknown as {untrackLoading: () => void}).untrackLoading()
  }
})
test('each pane copies the frame anew right before it draws', () => {
  expect(paneBackdrop().updateBeforeType).toBe(NodeUpdateType.OBJECT)
})
