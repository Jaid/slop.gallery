import {BoxGeometry, Euler, Group, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, RenderTarget, Scene, SphereGeometry, WebGPURenderer} from 'three/webgpu'

import gold from '../../src/lib/materials/gold.ts'
import {backdropLightness, gray, snapshotSize, snapshotWindow} from '../../src/lib/rendering/studio/studioSnapshot.ts'
import StudioSnapshotRenderer from '../../src/lib/rendering/studio/StudioSnapshotRenderer.ts'

/**
 * Photographs a gold apple with the studio after the gallery’s own kind of renderer has drawn its shared gold, like a throw in the game does, and checks the WebP: nothing but the backdrop outside the 960 px window, the object reaching its edge, and the gray contrasting with the object: dark behind a white ball, light behind a charcoal one.
 */
export default async function verifyStudioSnapshot() {
  const main = new WebGPURenderer({canvas: document.createElement('canvas')})
  const mainTarget = new RenderTarget(64, 64)
  const studio = new StudioSnapshotRenderer
  const sphere = new SphereGeometry(0.27, 32, 24)
  const stalk = new BoxGeometry(0.035, 0.18, 0.04)
  const white = new MeshBasicNodeMaterial({color: '#ffffff'})
  const charcoal = new MeshBasicNodeMaterial({color: '#262626'})
  const timings: Record<string, number> = {}
  try {
    // A gold apple with a stalk, inside a moved and turned parent like a rigid body’s object.
    const body = new Group
    body.position.set(-14, 1.57, 1)
    body.quaternion.setFromEuler(new Euler(0.7, 1.9, 0.3))
    const apple = new Group
    apple.name = 'prop-apple'
    const flesh = new Mesh(sphere, gold)
    flesh.scale.set(1, 0.93, 1)
    const stem = new Mesh(stalk, white)
    stem.position.set(0, 0.3, 0)
    apple.add(flesh, stem)
    body.add(apple)
    const scene = new Scene
    scene.add(body)
    await main.init()
    const camera = new PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(-14, 1.57, 3)
    camera.lookAt(body.position)
    main.setRenderTarget(mainTarget)
    main.render(scene, camera)
    main.setRenderTarget(null)
    let started = performance.now()
    const first = await studio.snapshot(apple)
    timings.firstSnapshotMs = performance.now() - started
    started = performance.now()
    const second = await studio.snapshot(apple)
    timings.secondSnapshotMs = performance.now() - started
    const appleReport = await inspect(first.image, first.lightness)
    const secondReport = await inspect(second.image, second.lightness)
    assert(Math.abs(appleReport.reach - secondReport.reach) <= 1, 'Two snapshots of the same object differ in framing.')
    // A white ball must get the dark backdrop and a charcoal one the light backdrop.
    const ball = new Group
    const paint = new Mesh(sphere, white)
    ball.add(paint)
    scene.add(ball)
    const light = await studio.snapshot(ball)
    const whiteReport = await inspect(light.image, light.lightness)
    assert(whiteReport.backdrop === 'dark', 'A white object did not get the dark backdrop.')
    paint.material = charcoal
    const dark = await studio.snapshot(ball)
    const charcoalReport = await inspect(dark.image, dark.lightness)
    assert(charcoalReport.backdrop === 'light', 'A charcoal object did not get the light backdrop.')
    return {
      apple: appleReport,
      whiteBall: whiteReport,
      charcoalBall: charcoalReport,
      timings,
    }
  } finally {
    await studio.disposeAsync()
    mainTarget.dispose()
    sphere.dispose()
    stalk.dispose()
    white.dispose()
    charcoal.dispose()
    await main.dispose()
  }
}

async function inspect(image: Blob, lightness: number | undefined) {
  assert(image.type === 'image/webp', `The snapshot is ${image.type}, not WebP.`)
  assert(lightness !== undefined, 'The lightness was not measured.')
  const bitmap = await createImageBitmap(image)
  assert(bitmap.width === snapshotSize && bitmap.height === snapshotSize, `The snapshot is ${bitmap.width}×${bitmap.height}.`)
  const canvas = new OffscreenCanvas(snapshotSize, snapshotSize)
  const context = canvas.getContext('2d')!
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const {data} = context.getImageData(0, 0, snapshotSize, snapshotSize)
  const backdrop = lightness > 0.5 ? 'dark' : 'light'
  const expected = Number(/\d+/u.exec(gray(backdropLightness[backdrop]))![0])
  const margin = (snapshotSize - snapshotWindow) / 2
  const isBackdrop = (index: number) => Math.abs(data[index] - expected) <= 3 && Math.abs(data[index + 1] - expected) <= 3 && Math.abs(data[index + 2] - expected) <= 3
  let outside = 0
  let reach = 0
  let object = 0
  for (let y = 0; y < snapshotSize; y++) {
    for (let x = 0; x < snapshotSize; x++) {
      const index = (y * snapshotSize + x) * 4
      if (isBackdrop(index)) {
        continue
      }
      object++
      const distance = Math.max(Math.abs(x + 0.5 - snapshotSize / 2), Math.abs(y + 0.5 - snapshotSize / 2))
      reach = Math.max(reach, distance)
      if (x < margin || y < margin || x >= snapshotSize - margin || y >= snapshotSize - margin) {
        outside++
      }
    }
  }
  assert(object > 50_000, `Only ${object} pixels show the object.`)
  assert(outside === 0, `${outside} object pixels lie outside the ${snapshotWindow} px window.`)
  assert(reach > snapshotWindow / 2 - 40, `The object reaches only ${reach} px from the center, not close to ${snapshotWindow / 2}.`)
  return {
    backdrop,
    bytes: image.size,
    lightness,
    object,
    reach,
  }
}
function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
