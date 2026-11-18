import type {Camera, Object3D} from 'three/webgpu'

import {afterEach, beforeEach, expect, test} from 'bun:test'

import {BoxGeometry, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, Renderer, Scene} from 'three/webgpu'

import GalleryDrawingPipeline from '../../src/lib/rendering/GalleryDrawingPipeline.ts'
import {GalleryRenderer} from '../../src/lib/rendering/GalleryRenderer.ts'

// eslint-disable-next-line typescript/unbound-method -- Restored after each test.
const render = Renderer.prototype.render
let projected: Array<Object3D> = []
const renderers: Array<GalleryRenderer> = []
beforeEach(() => {
  projected = []
  // Draws nothing; projects the scene the way three’s _renderScene does, which is all of a render the drawing pipeline sees.
  Renderer.prototype.render = function (this: Renderer, scene: Object3D, camera: Camera) {
    camera.updateMatrixWorld()
    this.drawingPipeline.begin(camera, {})
    this.drawingPipeline.project(scene, camera, 0, {
      push: (object: Object3D) => projected.push(object),
      pushLight() {},
    }, null as never)
  }
})
afterEach(() => {
  Renderer.prototype.render = render
  for (const renderer of renderers.splice(0)) {
    ;(renderer as unknown as {untrackLoading: () => void}).untrackLoading()
  }
})
const box = new BoxGeometry
const material = new MeshBasicNodeMaterial
/** a renderer on a stub canvas whose node frame is a stub too, so its frames start without a device */
const createRenderer = () => {
  const renderer = new GalleryRenderer({canvas: {style: {}} as HTMLCanvasElement})
  Object.assign(renderer, {_nodes: {nodeFrame: {frameId: 0}}})
  renderers.push(renderer)
  return renderer
}
const setup = () => {
  const renderer = createRenderer()
  const scene = new Scene
  const shown = new Mesh(box, material)
  const hidden = new Mesh(box, material)
  const behind = new Mesh(box, material)
  shown.position.z = -5
  hidden.position.z = -5
  behind.position.z = 5
  scene.add(shown, hidden, behind)
  const camera = new PerspectiveCamera
  renderer.setFrameScene(scene)
  return {
    behind,
    camera,
    hidden,
    renderer,
    scene,
    shown,
  }
}
/** starts a new frame, since the renderer projects the frame scene’s passes once per frame of its node frame */
const nextFrame = (renderer: GalleryRenderer) => {
  ;(renderer as unknown as {_nodes: {nodeFrame: {frameId: number}}})._nodes.nodeFrame.frameId++
}
test('three still projects every render through the renderer’s drawing pipeline, which the gallery’s culling, warming and streaming hook into', () => {
  const {_renderScene: renderScene} = Renderer.prototype as unknown as {_renderScene: () => void}
  expect(renderScene.toString()).toContain('this.drawingPipeline.project(')
  expect(createRenderer().drawingPipeline).toBeInstanceOf(GalleryDrawingPipeline)
})
test('the frame scene’s passes leave out hidden objects, except for unculled cameras', () => {
  const {camera, hidden, renderer, scene, shown} = setup()
  renderer.hidden.add(hidden)
  renderer.render(scene, camera)
  expect(projected).toEqual([shown])
  projected = []
  nextFrame(renderer)
  renderer.unculledCameras.add(camera)
  renderer.render(scene, camera)
  expect(projected).toEqual([shown, hidden])
})
test('objects hidden from view still cast into shadow maps', () => {
  const {camera, hidden, renderer, scene, shown} = setup()
  renderer.hiddenFromView.add(hidden)
  renderer.render(scene, camera)
  expect(projected).toEqual([shown])
  projected = []
  const shadowCamera = new PerspectiveCamera
  renderer.shadowCameras.add(shadowCamera)
  // Shadow maps render inside the frame’s passes, with the scene’s matrices frozen.
  scene.matrixWorldAutoUpdate = false
  renderer.render(scene, shadowCamera)
  expect(projected).toEqual([shown, hidden])
})
test('other scenes project like three’s default', () => {
  const {camera, hidden, renderer, shown} = setup()
  renderer.hidden.add(hidden)
  const other = new Scene
  other.add(shown, hidden)
  renderer.render(other, camera)
  expect(projected).toEqual([shown, hidden])
})
test('warming draws every object outside the frustum once per camera, a budget’s worth per frame, and leaves their culling as it was', () => {
  const {behind, camera, renderer, scene} = setup()
  renderer.setWarming(true)
  let behindDrawn = 0
  let frames = 0
  do {
    projected = []
    nextFrame(renderer)
    renderer.render(scene, camera)
    behindDrawn += projected.filter(object => object === behind).length
    expect(behind.frustumCulled).toBe(true)
    frames++
  } while (!(frames > 1 && renderer.warmedAll) && frames < 20)
  expect(behindDrawn).toBe(1)
  // Its budget admits about one new object per frame here, so warming took several.
  expect(frames).toBeGreaterThan(3)
  expect(renderer.warmedAll).toBe(true)
})
test('warming admits unbuilt objects nearest first by perceptual distance', () => {
  const renderer = createRenderer()
  const scene = new Scene
  // All three are outside the camera’s frustum (+z is behind), listed farthest first in the scene graph.
  const below = new Mesh(box, material)
  below.position.set(0, -4, 1) // 1 + 3 * 4 = 13
  const sameFloor = new Mesh(box, material)
  sameFloor.position.set(4, 0, 5) // 4 + 5 = 9
  const near = new Mesh(box, material)
  near.position.set(0, 0, 2) // 2
  scene.add(below, sameFloor, near)
  const camera = new PerspectiveCamera
  renderer.setFrameScene(scene)
  renderer.setWarming(true)
  const order: Array<Object3D> = []
  for (let frame = 0; frame < 4; frame++) {
    projected = []
    nextFrame(renderer)
    renderer.render(scene, camera)
    order.push(...projected)
  }
  expect(order).toEqual([near, sameFloor, below])
})
test('streaming prioritizes by room tier, visibility and perceptual distance, including for shadow passes and nested meshes', () => {
  const renderer = createRenderer()
  const scene = new Scene
  const camera = new PerspectiveCamera
  camera.position.set(0, 1.6, 0)
  // Geometries translated off-origin should measure to their world bounds, not their object origin.
  const farGeometry = new BoxGeometry
  farGeometry.translate(0, 0, -25)
  const unrelatedNear = new Mesh(box, material)
  unrelatedNear.position.set(0, 0, -2)
  unrelatedNear.userData.tier = Number.POSITIVE_INFINITY
  const relatedCulled = new Mesh(box, material)
  relatedCulled.position.set(0, 1.6, -3)
  relatedCulled.userData.tier = 1
  const relatedVisible = new Mesh(box, material)
  relatedVisible.position.set(0, 1.6, -8)
  relatedVisible.userData.tier = 1
  const ownFar = new Mesh(farGeometry, material)
  ownFar.userData.tier = 0
  const ownNear = new Mesh(box, material)
  ownNear.position.set(0, 1.6, -4)
  ownNear.userData.tier = 0
  const nestedChild = new Mesh(box, material)
  nestedChild.position.set(0, 0, -2) // world z = -6
  nestedChild.userData.tier = 0
  ownNear.add(nestedChild)
  scene.add(unrelatedNear, relatedCulled, relatedVisible, ownFar, ownNear)
  renderer.setFrameScene(scene)
  renderer.hiddenFromView.add(relatedCulled)
  renderer.setStreamPriority(object => object.userData.tier as number)
  renderer.setStreaming(true)
  const admissions: Array<Object3D> = []
  for (let frame = 0; frame < 8; frame++) {
    projected = []
    nextFrame(renderer)
    renderer.render(scene, camera)
    for (const object of projected) {
      if (!admissions.includes(object)) {
        admissions.push(object)
      }
    }
  }
  // Tier 0 nearest first (ownNear -> nestedChild -> ownFar), then Tier 1 visible before culled, then unrelated.
  expect(admissions).toEqual([ownNear, nestedChild, ownFar, relatedVisible, relatedCulled, unrelatedNear])
  // A shadow pass still prioritizes relative to the viewer’s camera, not the shadow camera’s own origin.
  const shadowCamera = new PerspectiveCamera
  shadowCamera.position.set(0, 100, -100)
  renderer.shadowCameras.add(shadowCamera)
  scene.matrixWorldAutoUpdate = false
  projected = []
  renderer.render(scene, shadowCamera)
  expect(projected).toEqual([ownNear])
})
