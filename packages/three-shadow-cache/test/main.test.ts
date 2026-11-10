import type {Camera} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {BoxGeometry, DirectionalLight, Frustum, Matrix4, Mesh, PerspectiveCamera, PointLight, Scene, SpotLight} from 'three/webgpu'

import ShadowCache, {reachesFrustum, ShadowRefresher} from '../src/main.ts'

const setup = () => {
  const scene = new Scene
  const lamp = new PointLight('#fff', 1, 5)
  lamp.castShadow = true
  lamp.position.set(0, 3, 0)
  const near = new Mesh(new BoxGeometry)
  near.castShadow = true
  const far = new Mesh(new BoxGeometry)
  far.castShadow = true
  far.position.set(20, 0, 0)
  scene.add(lamp, near, far)
  const cache = new ShadowCache
  const hidden = new Set<Mesh>
  let active = true
  const step = () => {
    lamp.shadow.needsUpdate = false
    scene.updateMatrixWorld()
    cache.update(scene, {
      active: () => active,
      hidden,
    })
    return lamp.shadow.needsUpdate
  }
  return {
    cache,
    far,
    hidden,
    lamp,
    near,
    scene,
    setActive: (value: boolean) => {
      active = value
    },
    step,
  }
}
test('a shadow map renders once and then only when a caster in reach changes', () => {
  const {far, lamp, near, step} = setup()
  expect(step()).toBe(true)
  expect(lamp.shadow.autoUpdate).toBe(false)
  expect(step()).toBe(false)
  far.position.x = 21
  expect(step()).toBe(false)
  near.position.x = 0.5
  expect(step()).toBe(true)
  expect(step()).toBe(false)
  // Leaving the reach clears the spot it left.
  near.position.x = 30
  expect(step()).toBe(true)
  expect(step()).toBe(false)
})
test('wobbling below a millimeter keeps the shadow map until it adds up', () => {
  const {near, step} = setup()
  step()
  near.position.x = 0.0004
  expect(step()).toBe(false)
  near.position.x = 0.0008
  expect(step()).toBe(false)
  near.position.x = 0.0012
  expect(step()).toBe(true)
})
test('the tolerance decides how far a caster may move unnoticed', () => {
  const scene = new Scene
  const lamp = new PointLight('#fff', 1, 5)
  lamp.castShadow = true
  const caster = new Mesh(new BoxGeometry)
  caster.castShadow = true
  scene.add(lamp, caster)
  const cache = new ShadowCache({tolerance: 0.1})
  const step = () => {
    lamp.shadow.needsUpdate = false
    scene.updateMatrixWorld()
    cache.update(scene)
    return lamp.shadow.needsUpdate
  }
  expect(step()).toBe(true)
  caster.position.x = 0.05
  expect(step()).toBe(false)
  caster.position.x = 0.15
  expect(step()).toBe(true)
})
test('casters that appear, disappear or hide count as changes', () => {
  const {hidden, near, scene, step} = setup()
  step()
  hidden.add(near)
  expect(step()).toBe(true)
  hidden.delete(near)
  expect(step()).toBe(true)
  near.visible = false
  expect(step()).toBe(true)
  near.visible = true
  step()
  const added = new Mesh(new BoxGeometry)
  added.castShadow = true
  scene.add(added)
  expect(step()).toBe(true)
  added.removeFromParent()
  expect(step()).toBe(true)
  added.castShadow = false
  scene.add(added)
  expect(step()).toBe(false)
})
test('lamps ignore casters changing out of sight, but see them come into or go out of sight', () => {
  const {hidden, near, scene, step} = setup()
  step()
  hidden.add(near)
  expect(step()).toBe(true)
  near.position.x = 0.5
  expect(step()).toBe(false)
  hidden.delete(near)
  expect(step()).toBe(true)
  // Moving while going out of sight still takes it out of the map, and moving while coming back puts it in again.
  hidden.add(near)
  near.position.x = 1
  expect(step()).toBe(true)
  hidden.delete(near)
  near.position.x = 0.5
  expect(step()).toBe(true)
  // A caster streaming in out of sight leaves the map alone.
  const added = new Mesh(new BoxGeometry)
  added.castShadow = true
  hidden.add(added)
  scene.add(added)
  expect(step()).toBe(false)
})
test('an inactive light keeps its update until it is active again', () => {
  const {lamp, near, setActive, step} = setup()
  step()
  setActive(false)
  near.position.y = 1
  expect(step()).toBe(false)
  expect(step()).toBe(false)
  setActive(true)
  expect(step()).toBe(true)
  expect(step()).toBe(false)
  lamp.position.x = 1
  expect(step()).toBe(true)
})
test('a new light renders its shadow map right away, even while inactive', () => {
  const {setActive, step} = setup()
  setActive(false)
  expect(step()).toBe(true)
  expect(step()).toBe(false)
})
test('directional lights test changes against their shadow camera', () => {
  const scene = new Scene
  const sun = new DirectionalLight
  sun.castShadow = true
  sun.position.set(0, 10, 0)
  Object.assign(sun.shadow.camera, {
    top: 5,
    bottom: -5,
    left: -5,
    right: 5,
  })
  sun.shadow.camera.updateProjectionMatrix()
  const inside = new Mesh(new BoxGeometry)
  inside.castShadow = true
  const outside = new Mesh(new BoxGeometry)
  outside.castShadow = true
  outside.position.set(30, 0, 0)
  scene.add(sun, inside, outside)
  const cache = new ShadowCache
  const step = () => {
    sun.shadow.needsUpdate = false
    scene.updateMatrixWorld()
    cache.update(scene)
    return sun.shadow.needsUpdate
  }
  expect(step()).toBe(true)
  outside.position.x = 31
  expect(step()).toBe(false)
  inside.position.x = 1
  expect(step()).toBe(true)
})
test('directional lights ignore casters hiding, since they draw hidden ones too', () => {
  const scene = new Scene
  const sun = new DirectionalLight
  sun.castShadow = true
  sun.position.set(0, 10, 0)
  const caster = new Mesh(new BoxGeometry)
  caster.castShadow = true
  scene.add(sun, caster)
  const cache = new ShadowCache
  const hidden = new Set<Mesh>
  const step = () => {
    sun.shadow.needsUpdate = false
    scene.updateMatrixWorld()
    cache.update(scene, {hidden})
    return sun.shadow.needsUpdate
  }
  step()
  hidden.add(caster)
  expect(step()).toBe(false)
  hidden.delete(caster)
  expect(step()).toBe(false)
})
test('directional lights put off casters changing out of sight until a room shows again', () => {
  const scene = new Scene
  const sun = new DirectionalLight
  sun.castShadow = true
  sun.position.set(0, 10, 0)
  const caster = new Mesh(new BoxGeometry)
  caster.castShadow = true
  scene.add(sun, caster)
  const cache = new ShadowCache
  const hidden = new Set<Mesh>
  const step = () => {
    sun.shadow.needsUpdate = false
    scene.updateMatrixWorld()
    cache.update(scene, {hidden})
    return sun.shadow.needsUpdate
  }
  step()
  hidden.add(caster)
  expect(step()).toBe(false)
  // A Knot turning in a room out of sight leaves the map alone, frame after frame …
  caster.position.x = 1
  expect(step()).toBe(false)
  caster.position.x = 2
  expect(step()).toBe(false)
  // … and renders it once the room shows again.
  hidden.delete(caster)
  expect(step()).toBe(true)
  expect(step()).toBe(false)
  caster.position.x = 3
  expect(step()).toBe(true)
  // Moving while going out of sight counts at once, since the map draws it where it went.
  hidden.add(caster)
  caster.position.x = 4
  expect(step()).toBe(true)
})
test('a light reaches the view where its range meets the camera’s frustum, wherever the light itself is', () => {
  // Standing on a floor and looking north, with a lamp hanging 7 m under the floor ahead.
  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 100)
  camera.position.set(0, 1.7, 0)
  camera.lookAt(0, 1.7, -6)
  camera.updateMatrixWorld()
  const frustum = new Frustum
  const viewProjection = new Matrix4
  const view = () => frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem)
  const below = new PointLight('#fff', 1, 10)
  below.position.set(0, -7, -6)
  below.updateMatrixWorld()
  expect(reachesFrustum(below, view())).toBe(true)
  const short = new PointLight('#fff', 1, 3)
  short.position.copy(below.position)
  short.updateMatrixWorld()
  expect(reachesFrustum(short, view())).toBe(false)
  // Without a range, the shadow camera’s far plane bounds the reach.
  const open = new PointLight('#fff', 1, 0)
  open.position.copy(below.position)
  open.shadow.camera.far = 3
  open.updateMatrixWorld()
  expect(reachesFrustum(open, view())).toBe(false)
  open.shadow.camera.far = 10
  expect(reachesFrustum(open, view())).toBe(true)
  const spot = new SpotLight('#fff', 1, 10)
  spot.position.copy(below.position)
  spot.updateMatrixWorld()
  expect(reachesFrustum(spot, view())).toBe(true)
  // Further south and turned around, the lamp is behind the camera.
  camera.position.z = 20
  camera.lookAt(0, 1.7, 30)
  camera.updateMatrixWorld()
  expect(reachesFrustum(below, view())).toBe(false)
  expect(reachesFrustum(new DirectionalLight, view())).toBe(true)
})
test('dispose restores updates every frame', () => {
  const {cache, lamp, step} = setup()
  step()
  cache.dispose()
  expect(lamp.shadow.autoUpdate).toBe(true)
})
test('incomplete shadow maps render again one per frame, each in turn, and start over once all had theirs', () => {
  const lamps = [0, 1, 2].map(() => new PointLight('#fff', 1, 5))
  const incomplete = new Set<Camera>([lamps[0].shadow.camera, lamps[2].shadow.camera])
  const refresher = new ShadowRefresher
  /** which lamps the refresher lets render this frame */
  const frame = () => {
    for (const lamp of lamps) {
      lamp.shadow.needsUpdate = false
      refresher.visit(lamp, camera => incomplete.has(camera))
    }
    refresher.endFrame()
    return lamps.entries().filter(([, lamp]) => lamp.shadow.needsUpdate).map(([index]) => index).toArray()
  }
  expect(frame()).toEqual([0])
  expect(frame()).toEqual([2])
  // Every incomplete map had its turn, so this frame renders none and the next round begins.
  expect(frame()).toEqual([])
  expect(frame()).toEqual([0])
  incomplete.clear()
  expect(frame()).toEqual([])
  expect(frame()).toEqual([])
})
