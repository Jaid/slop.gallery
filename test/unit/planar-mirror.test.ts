import {expect, test} from 'bun:test'

import {Mesh, PerspectiveCamera, PlaneGeometry, RenderTarget, Scene, WebGPURenderer} from 'three/webgpu'

import PlanarMirrorMaterial, {getReflectionHeight, renderPlanarReflection, setReflectionHeight} from '../../src/lib/materials/PlanarMirrorMaterial.ts'

test('switching planes draws at most one reflected view and only mixes it into the selected surfaces', () => {
  const previous = getReflectionHeight()
  const scene = new Scene
  const geometry = new PlaneGeometry(3, 3)
  const surfaces = [0, 0.002, 3, -5].map((height, index) => {
    const material = new PlanarMirrorMaterial(null, {
      color: '#ffffff',
      roughness: 0.7,
      reflection: {
        strength: 0.25,
        grazingStrength: 0,
        loss: 0,
      },
    })
    const mesh = new Mesh(geometry, material)
    mesh.position.y = height
    mesh.rotation.x = index === 2 ? Math.PI / 2 : -Math.PI / 2
    mesh.add(material.reflectionTarget!)
    scene.add(mesh)
    return material
  })
  const camera = new PerspectiveCamera(75, 1, 0.1, 100)
  camera.position.set(0, 1, 16)
  const renderer = new WebGPURenderer({canvas: {
    width: 16,
    height: 16,
  } as HTMLCanvasElement})
  const target = new RenderTarget(16, 16)
  const eyes: Array<number> = []
  renderer.render = (_scene, reflected) => {
    eyes.push(reflected.position.y)
  }
  const draw = (height: number | null) => {
    eyes.length = 0
    setReflectionHeight(height)
    renderPlanarReflection({
      camera,
      mrt: null,
      renderer,
      scene,
      target,
    })
    return surfaces.map(material => material.mirrored.value)
  }
  try {
    expect(draw(0)).toEqual([1, 1, 0, 0])
    expect(eyes).toHaveLength(1)
    expect(eyes[0]).toBeCloseTo(-1)
    expect(draw(3)).toEqual([0, 0, 1, 0])
    expect(eyes).toHaveLength(1)
    expect(eyes[0]).toBeCloseTo(5)
    expect(draw(-5)).toEqual([0, 0, 0, 1])
    expect(eyes).toHaveLength(1)
    expect(eyes[0]).toBeCloseTo(-11)
    expect(draw(null)).toEqual([0, 0, 0, 0])
    expect(eyes).toEqual([])
    camera.rotation.y = Math.PI
    draw(0)
    expect(eyes).toEqual([])
  } finally {
    setReflectionHeight(previous)
    for (const material of surfaces) {
      material.dispose()
    }
    geometry.dispose()
    target.dispose()
  }
})
