import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {color, frameId, mix, positionLocal, time, viewportOpaqueMipTexture} from 'three/tsl'
import {BoxGeometry, Color, DataUtils, HalfFloatType, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, PlaneGeometry, RenderTarget, Scene, SphereGeometry, WebGPURenderer} from 'three/webgpu'

import FrozenLightningMaterial from '../../packages/knot-materials/src/entries/frozen_lightning/Material.ts'
import {createKnotGeometry} from '../../packages/knot-materials/src/geometry.ts'
import StudioEnvironment from '../../packages/knot-materials/src/StudioEnvironment.ts'
import CastFloorGlassMaterial from '../../src/lib/materials/CastFloorGlassMaterial.ts'
import CrownGlassMaterial from '../../src/lib/materials/CrownGlassMaterial.ts'
import VaultGlassMaterial from '../../src/lib/materials/VaultGlassMaterial.ts'
import BatsOrbMaterial from '../../src/orbs/halloween/BatsOrbMaterial.ts'
import EyeOrbMaterial from '../../src/orbs/horror/EyeOrbMaterial.ts'
import PaintsOrbMaterial from '../../src/orbs/paint/PaintsOrbMaterial.ts'
import GhostsOrbMaterial from '../../src/orbs/spook/GhostsOrbMaterial.ts'
import ClearOrbMaterial from '../../src/orbs/transparent/ClearOrbMaterial.ts'

/** Detached native WebGPU regression: the same opaque and transparent shader output must refract identically. */
export default async function verifyGlassRefraction() {
  // This fixture owns its three module instance; do not run it against the page’s live imports.
  time.onRenderUpdate(() => 0)
  frameId.onRenderUpdate(() => 0)
  const size = 256
  const renderer = new WebGPURenderer({canvas: document.createElement('canvas')})
  const target = new RenderTarget(size, size, {type: HalfFloatType})
  const alternate = new RenderTarget(128, 128, {type: HalfFloatType})
  const multisampled = new RenderTarget(size, size, {
    type: HalfFloatType,
    samples: 4,
  })
  const environment = new StudioEnvironment
  const ball = new SphereGeometry(0.6, 48, 32)
  const knot = createKnotGeometry()
  const subjects = [
    new Mesh(knot, new FrozenLightningMaterial(environment)),
    ...[ClearOrbMaterial, BatsOrbMaterial, EyeOrbMaterial, PaintsOrbMaterial, GhostsOrbMaterial].map(Material => new Mesh(ball, new Material({radius: 0.6}))),
  ]
  const scene = new Scene
  scene.background = new Color('#180b28')
  const camera = new PerspectiveCamera(50, 1, 0.1, 50)
  camera.position.z = 6
  const geometry = new PlaneGeometry(1.6, 1.6)
  const opaque = new MeshBasicNodeMaterial
  const transparent = new MeshBasicNodeMaterial({transparent: true})
  const pattern = mix(color('#fc2040'), color('#20c8ff'), positionLocal.x.mul(40).sin().step(0))
  opaque.colorNode = pattern
  transparent.colorNode = pattern
  const object = new Mesh(geometry, opaque)
  scene.add(object)
  const glass = new CastFloorGlassMaterial({
    thickness: 0.12,
    tileSize: 1,
  })
  glass.depthWrite = false
  const crown = new CrownGlassMaterial({
    name: 'crown-test',
    ior: 1.52,
    absorption: 0.06,
    paneSize: [4, 4],
    grime: 0.5,
    haze: 0.035,
    smudges: 0.065,
    waviness: 0.005,
  })
  const vault = new VaultGlassMaterial
  const paneGeometry = new BoxGeometry(4, 0.12, 4)
  const pane = new Mesh<BoxGeometry, MeshPhysicalNodeMaterial>(paneGeometry, glass)
  pane.rotation.x = Math.PI / 2
  pane.position.z = 2
  scene.add(pane)
  // Take the shared opaque snapshot early, like an orb or a transmissive Knot does. Glass must not reuse it.
  const readerMaterial = new MeshBasicNodeMaterial({transparent: true})
  readerMaterial.colorNode = (viewportOpaqueMipTexture() as Node<'vec4'>).rgb
  const reader = new Mesh(geometry, readerMaterial)
  reader.position.set(2.5, 0, -1)
  reader.renderOrder = -2
  scene.add(reader)
  const independentGlass = new CastFloorGlassMaterial({
    thickness: 0.12,
    tileSize: 1,
  })
  independentGlass.depthWrite = false
  const wallGeometry = new PlaneGeometry(12, 12)
  const errors: Array<string> = []
  const results = []
  try {
    await renderer.init()
    const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    let copies = 0
    const copy = renderer.copyFramebufferToTexture.bind(renderer)
    renderer.copyFramebufferToTexture = (...args) => {
      copies++
      copy(...args)
    }
    const read = async (destination = target) => {
      copies = 0
      renderer.setRenderTarget(destination)
      renderer.render(scene, camera)
      const raw = await renderer.readRenderTargetPixelsAsync(destination, 0, 0, destination.width, destination.height) as Uint16Array
      return Float32Array.from(raw, value => DataUtils.fromHalfFloat(value))
    }
    const difference = (a: Float32Array, b: Float32Array) => {
      let sum = 0
      for (let i = 0; i < a.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
          sum += Math.abs(a[i + channel] - b[i + channel])
        }
      }
      return sum / (a.length / 4 * 3)
    }
    for (const paneMaterial of [glass, crown, vault]) {
      pane.material = paneMaterial
      for (const z of [0, 3]) {
        object.position.z = z
        object.material = opaque
        const reference = await read()
        object.material = transparent
        const actual = await read()
        assert(copies === 3, `Expected one opaque copy and one glass color/depth pair, got ${copies}.`)
        const error = difference(reference, actual)
        assert(error < 0.0001, `Opaque/transparent disagreement at z=${z}: ${error}`)
        results.push({
          glass: paneMaterial.name,
          z,
          error,
        })
      }
    }
    pane.material = glass
    // Two overlapping panes share a material. Each must copy the color left by the previous pane, not the first pane’s backdrop.
    object.position.z = 0
    const second = new Mesh(paneGeometry, glass)
    second.rotation.copy(pane.rotation)
    second.position.z = 3
    scene.add(second)
    const shared = await read()
    assert(copies === 5, `Two panes must copy two pairs, got ${copies - 1} copies.`)
    second.material = independentGlass
    const independent = await read()
    const sharedError = difference(shared, independent)
    assert(sharedError < 0.0001, `Shared glass material reused a stale snapshot: ${sharedError}`)
    second.visible = false
    const onePane = await read()
    const secondPaneDifference = difference(shared, onePane)
    assert(secondPaneDifference > 0.001, `Second pane did not contribute: ${secondPaneDifference}`)
    pane.visible = false
    const raw = await read()
    const distortion = difference(onePane, raw)
    assert(distortion > 0.01, `Glass did not affect the shader output: ${distortion}`)
    // Alternate render targets (e.g. a floor reflection) and resize without sharing stale color or depth.
    pane.visible = true
    const small = await read(alternate)
    const mainAgain = await read()
    assert(difference(mainAgain, onePane) < 0.0001, 'Reflection target contaminated the main view.')
    target.setSize(128, 128)
    const resized = await read()
    assert(difference(resized, small) < 0.0001, 'Resized glass retained the old framebuffer size.')
    target.setSize(size, size)
    const antialiased = await read(multisampled)
    assert(antialiased.every(Number.isFinite), 'Multisampled glass produced invalid pixels.')
    assert(difference(antialiased, onePane) < 0.003, 'Multisampling broke the glass backdrop.')
    // The reported material and all five real orb shaders: no raw, unfiltered silhouettes left over the pane.
    object.visible = false
    reader.visible = false
    const wall = new Mesh(wallGeometry, opaque)
    wall.position.z = -2
    scene.add(wall)
    pane.visible = false
    const emptyRaw = await read()
    pane.visible = true
    const emptyGlass = await read()
    const objects = []
    for (const subject of subjects) {
      scene.add(subject)
      pane.visible = false
      const unfiltered = await read()
      pane.visible = true
      const filtered = await read()
      let visiblePixels = 0
      let changedPixels = 0
      let transmittedPixels = 0
      for (let i = 0; i < filtered.length; i += 4) {
        const distance = (a: Float32Array, b: Float32Array) => Math.max(...[0, 1, 2].map(channel => Math.abs(a[i + channel] - b[i + channel])))
        if (distance(unfiltered, emptyRaw) > 0.03) {
          visiblePixels++
          if (distance(filtered, unfiltered) > 0.002) {
            changedPixels++
          }
        }
        if (distance(filtered, emptyGlass) > 0.03) {
          transmittedPixels++
        }
      }
      assert(visiblePixels > 200, `${subject.material.name}: no object to test.`)
      assert(changedPixels / visiblePixels > 0.9, `${subject.material.name}: raw shader pixels survived the glass (${changedPixels} of ${visiblePixels}).`)
      assert(transmittedPixels > visiblePixels * 0.2, `${subject.material.name}: object disappeared behind the glass.`)
      objects.push({
        name: subject.material.name,
        visiblePixels,
        changedPixels,
        transmittedPixels,
      })
      scene.remove(subject)
    }
    await device.queue.onSubmittedWorkDone()
    assert(errors.length === 0, errors.join('\n'))
    return {
      results,
      sharedError,
      secondPaneDifference,
      distortion,
      objects,
      errors,
    }
  } finally {
    renderer.setRenderTarget(null)
    geometry.dispose()
    paneGeometry.dispose()
    glass.dispose()
    crown.dispose()
    vault.dispose()
    independentGlass.dispose()
    for (const subject of subjects) {
      subject.material.dispose()
    }
    ball.dispose()
    knot.dispose()
    environment.dispose()
    wallGeometry.dispose()
    alternate.dispose()
    multisampled.dispose()
    opaque.dispose()
    transparent.dispose()
    readerMaterial.dispose()
    target.dispose()
    await renderer.dispose()
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
