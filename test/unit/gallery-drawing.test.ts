import type {Camera, Object3D} from 'three/webgpu'

import {afterEach, beforeEach, expect, test} from 'bun:test'

import {BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, Renderer, Scene} from 'three/webgpu'

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
test('warmup budgets the visible draws too and ranks by perceptual distance, not traversal or straight-line distance', () => {
  const {camera, renderer, scene} = setup()
  const across = new Mesh(box, material)
  const upstairs = new Mesh(box, material)
  across.position.z = -6
  upstairs.position.set(0, 1.5, -4)
  scene.clear().add(upstairs, across)
  renderer.setWarming(true)
  renderer.render(scene, camera)
  expect(projected).toEqual([across])
  expect(renderer.warmedAll).toBe(false)
  projected = []
  nextFrame(renderer)
  renderer.render(scene, camera)
  expect(projected).toContain(upstairs)
  expect(scene.children).toEqual([upstairs, across])
})
test('streaming builds related rooms first, then ranks unbuilt objects from the current view each frame', () => {
  const {camera, renderer, scene} = setup()
  const related = new Mesh(box, material)
  // An offset geometry inside a translated parent, as in a batch: its world center, not its pivot, is nearer.
  const offsetBox = new BoxGeometry
  offsetBox.translate(-15, 0, 0)
  const shifted = new Mesh(offsetBox, material)
  const group = new Group
  group.position.x = 14
  group.add(shifted)
  const far = new Mesh(box, material)
  const closer = new Mesh(box, material)
  const last = new Mesh(box, material)
  related.position.set(0, 0, -20)
  far.position.set(10, 0, -5)
  closer.position.set(4, 0, -5)
  last.position.set(-6, 0, -5)
  shifted.position.z = -5
  scene.clear().add(far, last, related, closer, group)
  renderer.hidden.add(shifted)
  renderer.setStreamPriority(object => object === related)
  renderer.setStreaming(true)
  const firstDraws = new Set<Object3D>
  const step = () => {
    projected = []
    nextFrame(renderer)
    renderer.render(scene, camera)
    const fresh = projected.filter(object => !firstDraws.has(object))
    for (const object of fresh) {
      firstDraws.add(object)
    }
    return fresh
  }
  expect(step()).toEqual([related])
  expect(step()).toEqual([])
  expect(step()).toEqual([shifted])
  camera.position.x = 10
  expect(step()).toEqual([far])
  expect(step()).toEqual([closer])
  expect(step()).toEqual([last])
  expect(scene.children).toEqual([far, last, related, closer, group])
})
test('shadow streaming ranks casters from the main camera, not the light, and tracks deferred draws', () => {
  const {camera, renderer, scene, shown, behind, hidden} = setup()
  const shadow = new PerspectiveCamera
  shadow.position.z = 10
  renderer.shadowCameras.add(shadow)
  shown.castShadow = true
  behind.castShadow = true
  hidden.position.z = -1
  camera.position.z = -2
  renderer.setStreaming(true)
  renderer.prepass(scene, camera, () => renderer.render(scene, shadow))
  expect(projected).toContain(shown)
  expect(projected).not.toContain(behind)
  projected = []
  nextFrame(renderer)
  renderer.prepass(scene, camera, () => {
    expect(renderer.shadowIncomplete(shadow)).toBe(true)
    renderer.render(scene, shadow)
  })
  expect(projected).toContain(behind)
  nextFrame(renderer)
  renderer.prepass(scene, camera, () => expect(renderer.shadowIncomplete(shadow)).toBe(false))
})
test('a queued mesh is admitted once for all its material groups, without invisible meshes taking its turn', () => {
  const {camera, renderer, scene} = setup()
  const invisibleParent = new Group
  invisibleParent.visible = false
  invisibleParent.add(new Mesh(box, material))
  const invisibleMaterial = new MeshBasicNodeMaterial({visible: false})
  const invisibleMesh = new Mesh(box, invisibleMaterial)
  const grouped = new Mesh(box, Array.from({length: 6}, () => material))
  grouped.position.z = -6
  scene.clear().add(invisibleParent, invisibleMesh, grouped)
  renderer.setStreaming(true)
  renderer.render(scene, camera)
  expect(projected).toEqual(Array.from({length: 6}, () => grouped))
})
