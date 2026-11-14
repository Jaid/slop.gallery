import {describe, expect, test} from 'bun:test'

import {Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Sphere, SphereGeometry, TorusGeometry, Vector3} from 'three/webgpu'

import {averageLightness, backdropFor, backdropLightness, fallbackBackdrop, frameObject, gray, lightnessOf, snapshotFov, snapshotSize, snapshotWindow} from '../../src/lib/rendering/studio/studioSnapshot.ts'

const material = new MeshBasicMaterial
/** the projections of every vertex of `object` seen by `camera`, in pixels: the farthest from the image center on either axis and the midpoints of the projected x and y ranges */
const projection = (object: Group, camera: PerspectiveCamera) => {
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  let reach = 0
  const min = new Vector3(Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity)
  object.traverse(child => {
    if (!(child as Partial<Mesh>).isMesh) {
      return
    }
    const positions = (child as Mesh).geometry.getAttribute('position')
    for (let index = 0; index < positions.count; index++) {
      const point = new Vector3
      point.fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld).project(camera)
      reach = Math.max(reach, Math.abs(point.x), Math.abs(point.y))
      min.min(point)
      max.max(point)
    }
  })
  return {
    reach: reach * snapshotSize / 2,
    centerX: (min.x + max.x) / 2 * snapshotSize / 2,
    centerY: (min.y + max.y) / 2 * snapshotSize / 2,
  }
}
const look = (object: Group, direction: Vector3) => {
  object.updateMatrixWorld(true)
  const camera = new PerspectiveCamera(snapshotFov, 1, 0.01, 100)
  const box = new Box3
  box.setFromObject(object)
  const center = box.getCenter(new Vector3)
  camera.position.copy(center).add(direction)
  camera.lookAt(center)
  camera.position.copy(frameObject(object, camera.quaternion)!)
  return {
    box,
    camera,
    distance: camera.position.distanceTo(center),
  }
}
const oblique = new Vector3(Math.sin(0.35) * Math.cos(0.28), Math.sin(0.28), Math.cos(0.35) * Math.cos(0.28))
const assemble = (...meshes: Array<Mesh>) => {
  const group = new Group
  group.add(...meshes)
  return group
}
const apple = () => {
  const flesh = new Mesh(new SphereGeometry(0.27, 32, 24), material)
  flesh.scale.set(1, 0.93, 1)
  const stem = new Mesh(new BoxGeometry(0.035, 0.18, 0.04), material)
  stem.position.set(0, 0.3, 0)
  const group = assemble(flesh, stem)
  group.position.set(-14, 1.57, 1)
  group.rotation.set(0.7, 1.9, 0.3)
  return group
}
const ring = () => assemble(new Mesh(new TorusGeometry(0.18, 0.06, 12, 32), material))
describe('frameObject', () => {
  test('the farthest vertex lands exactly on the edge of the 960 px window, centered', () => {
    const rod = new Mesh(new BoxGeometry(0.04, 1.8, 0.04), material)
    rod.position.set(3, 1, -2)
    for (const object of [apple(), ring(), assemble(rod)]) {
      for (const direction of [oblique, new Vector3(0, 0, 1), new Vector3(1, 1, 1), new Vector3(0, 1, 0.001)]) {
        const {camera} = look(object, direction)
        const {reach, centerX, centerY} = projection(object, camera)
        expect(reach).toBeCloseTo(snapshotWindow / 2, 4)
        // The camera sits halfway between the two limiting vertices of each axis, which centers the projection up to the perspective of their differing depths (a 1.8 m rod seen end-on: 11 px).
        expect(Math.abs(centerX)).toBeLessThan(snapshotWindow * 0.02)
        expect(Math.abs(centerY)).toBeLessThan(snapshotWindow * 0.02)
      }
    }
  })
  test('a flat object is framed closer than its bounding sphere would allow', () => {
    const {box, distance} = look(ring(), new Vector3(0, 1, 0.001))
    const radius = box.getBoundingSphere(new Sphere).radius
    const sphereDistance = radius / Math.sin(Math.atan(snapshotWindow / snapshotSize * Math.tan(snapshotFov / 2 * Math.PI / 180)))
    expect(distance).toBeLessThan(sphereDistance * 0.8)
  })
  test('an object without vertices has no framing', () => {
    const camera = new PerspectiveCamera
    expect(frameObject(new Group, camera.quaternion)).toBeUndefined()
  })
})
describe('lightness', () => {
  test('gray round-trips through CIE lightness', () => {
    expect(gray(0)).toBe('rgb(0 0 0)')
    expect(gray(1)).toBe('rgb(255 255 255)')
    expect(gray(backdropLightness.light)).toBe('rgb(221 221 221)')
    expect(gray(backdropLightness.dark)).toBe('rgb(53 53 53)')
    expect(lightnessOf(0.18)).toBeCloseTo(0.4947, 3)
  })
  test('averages opaque pixels only, weighted by alpha, and picks the contrasting backdrop', () => {
    const width = 16
    const height = 16
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 8; y < height; y++) {
      for (let x = 0; x < width; x++) {
        pixels.set([255, 255, 255, x < 8 ? 255 : 0], (y * width + x) * 4)
      }
    }
    expect(averageLightness(pixels, width, height)).toBeCloseTo(1, 6)
    expect(backdropFor(averageLightness(pixels, width, height))).toBe(backdropLightness.dark)
    pixels.fill(0)
    expect(averageLightness(pixels, width, height)).toBeUndefined()
    expect(backdropFor(undefined)).toBe(fallbackBackdrop)
    for (let index = 3; index < pixels.length; index += 4) {
      pixels.set([40, 40, 40, 255], index - 3)
    }
    expect(backdropFor(averageLightness(pixels, width, height))).toBe(backdropLightness.light)
  })
  test('stops after its budget with an estimate from the rows sampled so far', () => {
    const width = 8
    const height = 64
    const pixels = new Uint8ClampedArray(width * height * 4)
    // The first pass visits rows 0, 8, 16, …; later passes would add the white rows in between.
    for (let y = 0; y < height; y++) {
      const value = y % 8 ? 255 : 0
      for (let x = 0; x < width; x++) {
        pixels.set([value, value, value, 255], (y * width + x) * 4)
      }
    }
    const late = averageLightness(pixels, width, height, {
      start: 0,
      now: () => 100,
    })
    expect(late).toBe(0)
    expect(averageLightness(pixels, width, height)).toBeCloseTo(lightnessOf(7 / 8), 6)
  })
  test('scans a full snapshot in a few milliseconds', () => {
    const pixels = new Uint8ClampedArray(snapshotSize * snapshotSize * 4)
    for (let index = 0; index < pixels.length; index += 4) {
      pixels.set([200, 150, 90, 255], index)
    }
    const start = performance.now()
    const lightness = averageLightness(pixels, snapshotSize, snapshotSize, {budgetMs: Infinity})
    const elapsed = performance.now() - start
    console.log(`full 1024² lightness scan: ${elapsed.toFixed(2)} ms`)
    expect(elapsed).toBeLessThan(25)
    expect(lightness).toBeCloseTo(lightnessOf(0.2126 * 0.5776 + 0.7152 * 0.305 + 0.0722 * 0.1022), 2)
  })
})
