import type {Camera, MeshBasicNodeMaterial, Object3D, Renderer} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'

import {BoxGeometry, BufferGeometry, Color, Mesh, PerspectiveCamera, Scene} from 'three/webgpu'

import WireframeRenderPipeline from '../src/WireframeRenderPipeline.ts'

/** A renderer that records what each pass would draw and, like three’s, throws on a wireframe of a mesh without positions. */
function recordingRenderer() {
  const passes: Array<Array<string>> = []
  const renderer = {
    autoClear: true,
    outputColorSpace: 'srgb',
    toneMapping: 0,
    render(scene: Scene, camera: Camera) {
      const drawn: Array<string> = []
      const project = (object: Object3D) => {
        if (!object.visible) {
          return
        }
        if ((object as Partial<Mesh>).isMesh && object.layers.test(camera.layers)) {
          if ((scene.overrideMaterial as Partial<MeshBasicNodeMaterial> | null)?.wireframe && !('position' in (object as Mesh).geometry.attributes)) {
            throw new TypeError('Cannot read properties of undefined (reading \'array\')')
          }
          drawn.push(object.name)
        }
        for (const child of object.children) {
          project(child)
        }
      }
      project(scene)
      passes.push(drawn)
    },
  }
  return {
    passes,
    renderer: renderer as unknown as Renderer,
  }
}
function sceneWithPlaceholder() {
  const scene = new Scene
  const solid = new Mesh(new BoxGeometry)
  solid.name = 'solid'
  const placeholder = new Mesh(new BufferGeometry)
  placeholder.name = 'placeholder'
  const child = new Mesh(new BoxGeometry)
  child.name = 'child'
  placeholder.add(child)
  scene.add(solid, placeholder)
  return {
    placeholder,
    scene,
  }
}
describe('WireframeRenderPipeline', () => {
  test('leaves meshes without positions out of the lines and draws their children', () => {
    const {passes, renderer} = recordingRenderer()
    const {placeholder, scene} = sceneWithPlaceholder()
    const pipeline = new WireframeRenderPipeline(renderer, scene, new PerspectiveCamera)
    pipeline.lineStyle = 'lines'
    pipeline.draw()
    expect(passes).toEqual([['solid', 'child'], ['solid', 'child']])
    expect(placeholder.layers.mask).toBe(1)
    pipeline.dispose()
  })
  test('clears the fill to the renderer’s clear color without a background, or else to the background', () => {
    const {renderer} = recordingRenderer()
    const {scene} = sceneWithPlaceholder()
    const fills: Array<[string | null, boolean]> = []
    const render = renderer.render.bind(renderer)
    renderer.autoClear = false
    renderer.render = (target: Scene, camera: Camera) => {
      fills.push([target.background instanceof Color ? `#${target.background.getHexString()}` : null, renderer.autoClear])
      render(target, camera)
    }
    const pipeline = new WireframeRenderPipeline(renderer, scene, new PerspectiveCamera)
    pipeline.draw()
    pipeline.background = '#123'
    pipeline.draw()
    expect(fills).toEqual([[null, true], ['#112233', true]])
    expect(renderer.autoClear).toBe(false)
    expect(scene.background).toBeNull()
    pipeline.dispose()
  })
  test('leaves highlighted meshes without positions out too', () => {
    const {passes, renderer} = recordingRenderer()
    const {placeholder, scene} = sceneWithPlaceholder()
    const pipeline = new WireframeRenderPipeline(renderer, scene, new PerspectiveCamera, 'placeholder')
    pipeline.lineStyle = 'lines'
    pipeline.draw()
    expect(passes).toEqual([['solid', 'child'], ['child'], ['solid'], ['child']])
    expect(placeholder.layers.mask).toBe(1)
    expect(placeholder.children[0].layers.mask).toBe(1)
    pipeline.dispose()
  })
})
