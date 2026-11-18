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
/** A scene of boxes behind the camera, which only warming or streaming draws, added farthest first, with the frame in which each was first drawn once it is. */
const spread = (renderer: GalleryRenderer, distances: ReadonlyArray<number>) => {
  const scene = new Scene
  const camera = new PerspectiveCamera
  const meshes = distances.map(distance => {
    const mesh = new Mesh(box, material)
    mesh.position.z = distance
    return mesh
  })
  scene.add(...meshes.toSorted((a, b) => b.position.z - a.position.z))
  renderer.setFrameScene(scene)
  const firstDrawn = new Map<Object3D, number>
  let frame = 0
  const run = (frames: number) => {
    for (const end = frame + frames; frame < end; frame++) {
      projected = []
      nextFrame(renderer)
      renderer.render(scene, camera)
      for (const object of projected) {
        if (!firstDrawn.has(object)) {
          firstDrawn.set(object, frame)
        }
      }
    }
  }
  return {
    camera,
    firstDrawn,
    meshes,
    run,
    scene,
  }
}
test('warming draws the objects nearest to the camera first, whatever their order in the scene', () => {
  const renderer = createRenderer()
  renderer.setWarming(true)
  const {firstDrawn, meshes, run} = spread(renderer, [3, 9, 20, 45])
  run(12)
  const frames = meshes.map(mesh => firstDrawn.get(mesh))
  expect(frames.every(frame => frame !== undefined)).toBe(true)
  // A budget’s worth per frame admits one of them here, so each comes in a frame of its own.
  expect(frames).toEqual(frames.toSorted((a, b) => a! - b!))
  const distinct = new Set(frames)
  expect(distinct.size).toBe(meshes.length)
  expect(renderer.warmedAll).toBe(true)
})
test('warming measures how far an object is by its nearest point, weighing height three times', () => {
  const renderer = createRenderer()
  renderer.setWarming(true)
  const {firstDrawn, meshes, run, scene} = spread(renderer, [6, 12])
  // Right below the camera, two floors down: 7.5 m away by height alone, which counts as 22.5 m.
  const below = new Mesh(box, material)
  below.position.set(0, -8, 3)
  scene.add(below)
  run(10)
  expect(firstDrawn.get(meshes[0])!).toBeLessThan(firstDrawn.get(meshes[1])!)
  expect(firstDrawn.get(meshes[1])!).toBeLessThan(firstDrawn.get(below)!)
})
test('warming goes on when what it planned to draw next leaves the scene', () => {
  const renderer = createRenderer()
  renderer.setWarming(true)
  const {firstDrawn, meshes, run, scene} = spread(renderer, [3, 9, 20])
  // The first frame finds out what waits and the second draws the nearest.
  run(2)
  expect(firstDrawn.has(meshes[0])).toBe(true)
  // The next nearest is the one the next frame plans for.
  scene.remove(meshes[1])
  run(8)
  expect(firstDrawn.has(meshes[1])).toBe(false)
  expect(firstDrawn.has(meshes[2])).toBe(true)
  expect(renderer.warmedAll).toBe(true)
})
test('streaming builds the objects nearest to the camera first, after those the priority accepts', () => {
  const renderer = createRenderer()
  renderer.setStreaming(true)
  const {firstDrawn, meshes, run} = spread(renderer, [4, 11, 25, 60])
  const preferred = meshes[2]
  renderer.setStreamPriority(object => object === preferred)
  run(12)
  const order = meshes.toSorted((a, b) => firstDrawn.get(a)! - firstDrawn.get(b)!)
  expect(meshes.every(mesh => firstDrawn.has(mesh))).toBe(true)
  expect(order).toEqual([preferred, meshes[0], meshes[1], meshes[3]])
})
test('what the nearest objects’ turns leave of the budget goes to farther objects that fit it', () => {
  const renderer = createRenderer()
  renderer.setWarming(true)
  // Objects of a material the camera’s passes built already cost little, those of one they haven’t, much.
  const cheap = new MeshBasicNodeMaterial
  const {camera, firstDrawn, meshes, run} = spread(renderer, [3, 8, 20, 30])
  meshes[2].material = cheap
  meshes[3].material = cheap
  ;(renderer as unknown as {builtMaterials: WeakMap<object, WeakSet<object>>}).builtMaterials.set(camera, new WeakSet([cheap]))
  run(2)
  // The nearest one gets its turn, the next expensive one waits for its own, and the cheap ones behind it fill the rest of the budget.
  expect(firstDrawn.get(meshes[0])).toBe(1)
  expect(firstDrawn.get(meshes[2])).toBe(1)
  expect(firstDrawn.get(meshes[3])).toBe(1)
  expect(firstDrawn.has(meshes[1])).toBe(false)
  run(1)
  expect(firstDrawn.get(meshes[1])).toBe(2)
})
