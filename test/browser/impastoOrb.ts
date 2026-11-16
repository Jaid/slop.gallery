import {AmbientLight, DirectionalLight, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, PlaneGeometry, SphereGeometry} from 'three/webgpu'

import Studio from '../../src/lib/rendering/studio/base/Studio.ts'
import ImpastoOrbMaterial from '../../src/orbs/impasto/ImpastoOrbMaterial.ts'

const size = 512
const radius = 0.14

/** Detached WebGPU regression: the actual refractive glass over an opaque studio backdrop, seen from several sides and frozen phases. Pass true when regenerating the portal photo to return its PNG as well. */
export default async function verifyImpastoOrb(photo = false) {
  const studio = new ImpastoStudio
  try {
    return await studio.verify(photo)
  } finally {
    await studio.disposeAsync()
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}
class ImpastoStudio extends Studio {
  private readonly material = new ImpastoOrbMaterial({radius})
  private readonly sphere = new SphereGeometry(radius, 96, 64)
  private readonly ball = new Mesh(this.sphere, this.material)
  private readonly camera = new PerspectiveCamera(35, 1, 0.01, 10)
  private readonly wallGeometry = new PlaneGeometry(10, 10)
  private readonly wallMaterial = new MeshBasicNodeMaterial({color: '#302a28'})
  private readonly wall = new Mesh(this.wallGeometry, this.wallMaterial)

  constructor() {
    const key = new DirectionalLight('#fff4dd', 2.5)
    key.position.set(-0.3, 0.5, 0.5)
    super([key, new AmbientLight('#ffffff', 0.4)])
    this.renderer.setSize(size, size, false)
    this.camera.position.set(0, 0, 0.49)
    this.wall.position.z = -0.4
    this.stage.add(this.ball, this.wall)
  }

  protected override releaseResources() {
    this.material.dispose()
    this.sphere.dispose()
    this.wallGeometry.dispose()
    this.wallMaterial.dispose()
  }

  async verify(photo: boolean) {
    await this.init()
    const samples = []
    let photograph: string | undefined
    let first: Uint8ClampedArray | undefined
    const started = performance.now()
    const context = document.createElement('canvas').getContext('2d', {willReadFrequently: true})!
    context.canvas.width = size
    context.canvas.height = size
    const draw = (seconds: number) => {
      this.setTime(seconds)
      this.renderer.render(this.scene, this.camera)
      context.clearRect(0, 0, size, size)
      context.drawImage(this.renderer.domElement, 0, 0, size, size)
      return context.getImageData(0, 0, size, size).data
    }
    for (const [yaw, pitch, seconds] of [[0, 0, 0], [1.4, 0.3, 0], [3.1, -0.3, 0], [0, 0, 15]]) {
      this.ball.rotation.set(pitch, yaw, 0)
      const pixels = draw(seconds)
      if (!first) {
        first = pixels
        // Fixed interior swatches catch stroke-index corruption (in particular a nested march loop shadowing the stroke index), which aggregate color/contrast checks miss.
        const at = (x: number, y: number) => pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 3)
        const gold = at(200, 100)
        const blue = at(300, 150)
        const ivory = at(200, 200)
        const coral = at(150, 300)
        const teal = at(400, 350)
        assert(gold[0] > gold[1] * 1.2 && gold[1] > gold[2] * 2, 'The gold stroke lost its pigment.')
        assert(blue[2] > blue[0] * 3 && blue[2] > blue[1] * 1.5, 'The blue stroke lost its pigment.')
        assert(Math.min(...ivory) > 170 && Math.max(...ivory) - Math.min(...ivory) < 50, 'The ivory stroke acquired colored bands.')
        assert(coral[0] > coral[1] * 1.5 && coral[1] > coral[2] * 1.15, 'The coral stroke lost its pigment.')
        assert(teal[1] > teal[0] * 1.7 && teal[2] > teal[0] * 1.5, 'The teal stroke lost its pigment.')
        if (photo) {
          // Supersample the portal photo’s shader edges, which a canvas MSAA resolve alone cannot smooth.
          this.renderer.setSize(size * 2, size * 2, false)
          draw(seconds)
          photograph = context.canvas.toDataURL('image/png')
          this.renderer.setSize(size, size, false)
        }
      }
      let bright = 0
      let dark = 0
      let colorful = 0
      let visible = 0
      const values: Array<number> = []
      // The sculpture itself, excluding the clear glass rim and the backdrop.
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (Math.hypot(x - size / 2, y - size / 2) > size * 0.3) {
            continue
          }
          const offset = (y * size + x) * 4
          const [r, g, b, a] = pixels.subarray(offset, offset + 4)
          assert(a === 255, 'The opaque studio has transparent pixels.')
          const high = Math.max(r, g, b)
          const low = Math.min(r, g, b)
          bright += Number(low > 248)
          dark += Number(high < 12)
          colorful += Number(high - low > 35)
          visible++
          values.push(0.2126 * r + 0.7152 * g + 0.0722 * b)
        }
      }
      values.sort((a, b) => a - b)
      const contrast = values[Math.floor(values.length * 0.9)] - values[Math.floor(values.length * 0.1)]
      assert(bright / visible < 0.05, 'The paint is blown out.')
      assert(dark / visible < 0.05, 'The sculpture has black sectors.')
      assert(colorful / visible > 0.35, 'The pigments disappeared.')
      assert(contrast > 35, 'The strokes lost their relief.')
      samples.push({
        yaw,
        pitch,
        seconds,
        contrast,
        colorful: colorful / visible,
      })
      // Frozen time is deterministic, independent of the renderer’s frame counter.
      const again = draw(seconds)
      assert(pixels.every((value, index) => Math.abs(value - again[index]) <= 1), 'The frozen sculpture changed between frames.')
    }
    this.ball.rotation.set(0, 0, 0)
    const turned = draw(15)
    const changed = turned.reduce((sum, value, index) => sum + Number(Math.abs(value - first![index]) > 10), 0)
    assert(changed > size * size * 0.1, 'The paint sculpture does not rotate.')
    assert(!this.errors.length, this.errors.join('\n'))
    return {
      samples,
      milliseconds: performance.now() - started,
      photograph,
    }
  }
}
