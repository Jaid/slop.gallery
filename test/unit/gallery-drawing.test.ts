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
    const list = {
      begin() {},
      finish() {},
      push: (object: Object3D) => projected.push(object),
      pushLight() {},
    }
    this.drawingPipeline.beginRenderList(list)
    this.drawingPipeline.project(scene, camera, 0, list, null as never)
    this.drawingPipeline.finishRenderList(list)
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
  // Cold drawables are admitted when the list finishes, before three sorts it for drawing.
  const source = renderScene.toString()
  const project = source.indexOf('this.drawingPipeline.project(')
  const finish = source.indexOf('this.drawingPipeline.finishRenderList(')
  expect(project).toBeGreaterThanOrEqual(0)
  expect(finish).toBeGreaterThan(project)
  expect(source.indexOf('renderList.sort(')).toBeGreaterThan(finish)
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
test('streaming builds hidden objects that skip frustum culling once, like any other, and leaves their culling off', () => {
  const {camera, hidden, renderer, scene} = setup()
  hidden.frustumCulled = false
  renderer.hidden.add(hidden)
  renderer.setStreaming(true)
  let hiddenDrawn = 0
  for (let frame = 0; frame < 10; frame++) {
    projected = []
    nextFrame(renderer)
    renderer.render(scene, camera)
    hiddenDrawn += projected.filter(object => object === hidden).length
    expect(hidden.frustumCulled).toBe(false)
  }
  expect(hiddenDrawn).toBe(1)
})
test.each(['warming', 'streaming'] as const)('%s admits new drawables by walking distance to their world bounds, independently of their parents', mode => {
  const renderer = createRenderer()
  const scene = new Scene
  const camera = new PerspectiveCamera
  camera.position.x = 100
  // All three lie behind the camera, so only newly admitted draws reach the list. The most distant mesh has its pivot closest to the camera, but its geometry starts 20 m to the side.
  const far = new Mesh(box.clone().translate(20, 0, 0), material)
  far.position.set(100, 0, 4)
  const upstairs = new Mesh(box, material)
  upstairs.position.set(100, 3, 4)
  // The child’s near edge is just 4.5 m away horizontally. Its middle alone would rank it behind both other meshes.
  const long = new BoxGeometry(40, 1, 1)
  const level = new Mesh(long.translate(19.5, 0, 0), material)
  level.position.x = 5
  far.add(level)
  scene.add(upstairs, far)
  renderer.setFrameScene(scene)
  if (mode === 'warming') {
    renderer.setWarming(true)
  } else {
    renderer.setStreaming(true)
  }
  for (const expected of [level, upstairs, far]) {
    nextFrame(renderer)
    projected = []
    renderer.render(scene, camera)
    expect(projected).toEqual([expected])
  }
  expect(scene.children).toEqual([upstairs, far])
  expect(far.children).toEqual([level])
})
test('shadows stream from the main view, with related rooms before unrelated ones and a new ranking after a move', () => {
  const renderer = createRenderer()
  const camera = new PerspectiveCamera
  const shadow = new PerspectiveCamera
  shadow.position.x = 50
  const scene = new Scene
  const meshes = [0, 15, 20, 50].map(x => {
    const mesh = new Mesh(box, material)
    mesh.position.set(x, 0, 5)
    scene.add(mesh)
    return mesh
  })
  renderer.setFrameScene(scene)
  renderer.setStreamPriority(object => object !== meshes[0])
  renderer.setStreaming(true)
  renderer.shadowCameras.add(shadow)
  const drawShadow = () => {
    nextFrame(renderer)
    projected = []
    renderer.prepass(scene, camera, () => renderer.render(scene, shadow))
    return projected
  }
  expect(drawShadow()).toEqual([meshes[1]])
  camera.position.x = 45
  expect(drawShadow()).toEqual([meshes[3]])
  expect(drawShadow()).toEqual([meshes[2]])
  expect(renderer.shadowIncomplete(shadow)).toBe(true)
  // The unrelated room follows once the last priority work clears the gate.
  const rest = [...drawShadow(), ...drawShadow()]
  expect(rest).toEqual([meshes[0]])
  drawShadow()
  expect(renderer.shadowIncomplete(shadow)).toBe(false)
})
