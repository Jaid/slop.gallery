import type {TransmittingEmission} from '../../src/lib/rendering/AlbedoRenderPipeline.ts'
import type {Material} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene} from 'three/webgpu'

import Sightline from '../../src/lib/rendering/Sightline.ts'

/** A camera at the origin looking down −z at a figure of two boxes ten meters away, in a group of its own that was never drawn. */
const stage = () => {
  const scene = new Scene
  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 1000)
  scene.add(camera)
  const figure = new Group
  figure.position.set(0, 0, -10)
  figure.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial), new Mesh(new BoxGeometry(0.5, 0.5, 3), new MeshBasicMaterial))
  const room = new Group
  room.add(figure)
  scene.add(room)
  /** Stands a pane across the view at the distance, drawn before it is asked about. */
  const pane = (distance: number, material: Material, parent: Group | Scene = scene) => {
    const mesh = new Mesh(new PlaneGeometry(4, 4), material)
    mesh.position.set(0, 0, -distance)
    parent.add(mesh)
    scene.updateMatrixWorld(true)
    return mesh
  }
  return {
    scene,
    camera,
    figure,
    pane,
  }
}
test('the middle of the view meets what it aims at at its nearest surface, wherever either has moved to since it was drawn', () => {
  const {camera, figure} = stage()
  const sightline = new Sightline
  // The long box reaches 1.5 m toward the eye.
  expect(sightline.distanceTo(figure, camera)).toBeCloseTo(8.5, 6)
  camera.rotation.y = 0.2
  expect(sightline.distanceTo(figure, camera)).toBeUndefined()
  camera.rotation.y = 0
  camera.position.x = 0.4
  // Past the long box, it meets the cube behind it.
  expect(sightline.distanceTo(figure, camera)).toBeCloseTo(9.5, 6)
  figure.position.x = 3
  expect(sightline.distanceTo(figure, camera)).toBeUndefined()
  camera.position.x = 3
  expect(sightline.distanceTo(figure, camera)).toBeCloseTo(8.5, 6)
})
test('only what is drawn and not looked through blocks the sight of it', () => {
  const {scene, camera, figure, pane} = stage()
  const sightline = new Sightline
  const distance = sightline.distanceTo(figure, camera)!
  // Nothing stands in the way: what is aimed at never hides itself, and neither does what stands behind it.
  expect(sightline.blocked(scene, figure, distance)).toBe(false)
  pane(12, new MeshBasicMaterial)
  expect(sightline.blocked(scene, figure, distance)).toBe(false)
  // The eye looks through a transparent pane, and through glass that glows with what lies behind it.
  pane(3, new MeshBasicMaterial({transparent: true}))
  const glass: MeshBasicMaterial & TransmittingEmission = Object.assign(new MeshBasicMaterial, {emissionIsTransmission: true as const})
  pane(4, glass)
  expect(sightline.blocked(scene, figure, distance)).toBe(false)
  // Neither a pane that is not drawn hides it, in a group that isn’t, with a material that isn’t or off the camera’s layers.
  const hidden = new Group
  hidden.visible = false
  scene.add(hidden)
  pane(5, new MeshBasicMaterial, hidden)
  pane(5.5, new MeshBasicMaterial({visible: false}))
  pane(5.7, new MeshBasicMaterial).layers.set(3)
  // Nor one that touches it or faces away from the eye.
  pane(distance - 0.005, new MeshBasicMaterial)
  pane(6, new MeshBasicMaterial).rotation.y = Math.PI
  scene.updateMatrixWorld(true)
  expect(sightline.blocked(scene, figure, distance)).toBe(false)
  // Of a mesh of several materials, the one the view meets decides: a block with a pane of glass toward the eye.
  const sides = Array.from({length: 6}, (_, side) => new MeshBasicMaterial({transparent: side === 4}))
  const block = new Mesh(new BoxGeometry(1, 1, 1), sides)
  block.position.set(0, 0, -6.5)
  scene.add(block)
  scene.updateMatrixWorld(true)
  expect(sightline.blocked(scene, figure, distance)).toBe(false)
  sides[4].transparent = false
  expect(sightline.blocked(scene, figure, distance)).toBe(true)
  block.visible = false
  // A wall hides it too, however deep in the scene it stands.
  const deep = new Group
  const deeper = new Group
  deep.add(deeper)
  scene.add(deep)
  pane(7, new MeshBasicMaterial, deeper)
  expect(sightline.blocked(scene, figure, distance)).toBe(true)
  deep.visible = false
  expect(sightline.blocked(scene, figure, distance)).toBe(false)
  // Asking leaves the line as it was aimed: further along it stands the pane behind the figure.
  expect(sightline.blocked(scene, figure, distance + 4)).toBe(true)
  expect(sightline.blocked(scene, figure, distance)).toBe(false)
})
