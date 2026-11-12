import renderCanvasTexture from 'canvas-textures/three'
import {attribute, texture, uv, vec2} from 'three/tsl'
import {InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, RenderTarget, Scene, SRGBColorSpace, WebGPURenderer} from 'three/webgpu'

import {labelAtlasColumns, labelBackground, labelHeight, labelTile, labelWidth} from '../../src/components/KnotLabels/layout.ts'

/** Detached rendering only: full-size atlas, row boundaries, final tile and late shader invalidation. */
export default async function verifyKnotLabels() {
  const count = 167
  const rows = Math.ceil(count / labelAtlasColumns)
  const indices = [0, labelAtlasColumns - 1, labelAtlasColumns, count - 1]
  const accents = ['#ff0000', '#00ff00', '#0000ff', '#ffff00']
  const atlas = renderCanvasTexture({
    width: labelAtlasColumns * labelWidth,
    height: rows * labelHeight,
    mipmaps: false,
    draw(context) {
      // Faces are HTML now; the upload and the tile mapping only need each tile’s accent stripe on the face color.
      for (let index = 0; index < count; index++) {
        const {x, y} = labelTile(index)
        context.fillStyle = labelBackground
        context.fillRect(x, y, labelWidth, labelHeight)
        context.fillStyle = accents[indices.indexOf(index)] ?? '#46d6ff'
        context.fillRect(x + 38, y + 41, 644, 8)
      }
    },
  })
  const geometry = new PlaneGeometry(1.5, 1)
  geometry.setAttribute('labelOffset', new InstancedBufferAttribute(new Float32Array(indices.flatMap(index => [
    index % labelAtlasColumns / labelAtlasColumns,
    1 - (Math.floor(index / labelAtlasColumns) + 1) / rows,
  ])), 2))
  const material = new MeshBasicNodeMaterial({color: labelBackground})
  material.toneMapped = false
  const mesh = new InstancedMesh(geometry, material, indices.length)
  for (let i = 0; i < indices.length; i++) {
    const labelPlacement = new Matrix4
    mesh.setMatrixAt(i, labelPlacement.makeTranslation((i - 1.5) * 1.5, 0, 0))
  }
  mesh.instanceMatrix.needsUpdate = true
  const scene = new Scene
  scene.add(mesh)
  const camera = new OrthographicCamera(-3, 3, 0.5, -0.5, 0.1, 10)
  camera.position.z = 2
  const renderer = new WebGPURenderer({
    canvas: document.createElement('canvas'),
    antialias: false,
  })
  const target = new RenderTarget(768, 128)
  target.texture.colorSpace = SRGBColorSpace
  const errors: Array<string> = []
  try {
    await renderer.init()
    const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    assert(atlas.image.width <= device.limits.maxTextureDimension2D && atlas.image.height <= device.limits.maxTextureDimension2D, 'Nameplate atlas exceeds the renderer texture limit.')
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, 768, 128)
    material.colorNode = texture(atlas, uv().mul(vec2(1 / labelAtlasColumns, 1 / rows)).add(attribute('labelOffset', 'vec2')))
    material.needsUpdate = true
    renderer.render(scene, camera)
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 768, 128)
    const pixel = (x: number, y: number) => {
      const start = (y * 768 + x) * 4
      return [pixels[start], pixels[start + 1], pixels[start + 2], pixels[start + 3]]
    }
    const expected = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255]]
    const stripes = indices.map((index, i) => {
      const color = pixel(i * 192 + 96, 12)
      assert(color.every((value, channel) => Math.abs(value - expected[i][channel]) <= 2), `Wrong atlas tile or orientation for label ${index}: ${JSON.stringify(color)}`)
      const background = pixel(i * 192 + 96, 76)
      assert(background.every((value, channel) => Math.abs(value - [18, 32, 41, 255][channel]) <= 2), `Wrong face background for label ${index}: ${JSON.stringify(background)}`)
      return color
    })
    assert(errors.length === 0, errors.join('\n'))
    return {
      size: [atlas.image.width, atlas.image.height],
      indices,
      stripes,
      errors,
    }
  } finally {
    mesh.dispose()
    geometry.dispose()
    material.dispose()
    atlas.dispose()
    target.dispose()
    await renderer.dispose()
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
