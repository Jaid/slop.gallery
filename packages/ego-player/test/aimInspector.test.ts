import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import {BoxGeometry, DoubleSide, Group, InstancedMesh, Matrix3, Matrix4, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Scene, Vector3} from 'three/webgpu'

import {AimInspector} from '../src/main.ts'

let scene: Scene
let camera: PerspectiveCamera
let inspector: AimInspector
beforeEach(() => {
  scene = new Scene
  camera = new PerspectiveCamera(62, 1, 0.05, 90)
  inspector = new AimInspector(scene, camera)
})
afterEach(() => {
  scene.traverse(object => {
    if (!(object instanceof Mesh)) {
      return
    }
    const mesh = object as Mesh
    mesh.geometry.dispose()
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.dispose()
    }
    if (object instanceof InstancedMesh) {
      object.dispose()
    }
  })
})
function box(z: number, name: string) {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({side: DoubleSide}))
  mesh.name = name
  mesh.position.z = z
  scene.add(mesh)
  return mesh
}
describe('aim inspection', () => {
  test('returns full-precision world hits ordered by distance, once per mesh', () => {
    const back = box(-6, 'behind')
    const front = box(-2.123456789, 'front')
    const result = inspector.getAim()
    expect(result.hits).toHaveLength(2)
    expect(result.hit).toBe(result.hits[0])
    expect(result.hits.map(hit => hit.mesh.uuid)).toEqual([front.uuid, back.uuid])
    expect(result.hit!.distance).toBeCloseTo(1.623456789, 10)
    expect(result.hit!.point).toEqual({
      x: 0,
      y: 0,
      z: -1.623456789,
    })
    expect(result.hit!.localPoint).toEqual({
      x: 0,
      y: 0,
      z: 0.5,
    })
    expect(result.hit!.normal).toEqual({
      x: 0,
      y: 0,
      z: 1,
    })
    expect(result.hit!.mesh.geometryType).toBe('BoxGeometry')
    expect(result.hit!.faceIndex).not.toBeNull()
    expect(result.hit!.uv).toEqual([0.5, 0.5])
    expect(result.hit!.instanceId).toBeNull()
    expect(result.origin).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
    expect(result.direction).toEqual({
      x: 0,
      y: 0,
      z: -1,
    })
  })
  test('refreshes camera and parent transforms on demand without a render loop', () => {
    const rig = new Group
    rig.position.set(3, 1.25, 4)
    rig.rotation.y = Math.PI / 2
    rig.add(camera)
    scene.add(rig)
    const mesh = box(4, 'side-wall')
    mesh.position.set(0, 1.25, 4)
    const first = inspector.getAim()
    expect(first.origin).toEqual({
      x: 3,
      y: 1.25,
      z: 4,
    })
    expect(first.hit!.point.x).toBeCloseTo(0.5)
    expect(first.hit!.point.y).toBeCloseTo(1.25)
    expect(first.hit!.point.z).toBeCloseTo(4)
    mesh.position.x = -1
    const second = inspector.getAim()
    expect(second.hit!.point.x).toBeCloseTo(-0.5)
    expect(first.hit!.point.x).toBeCloseTo(0.5)
    expect(second.hit!.distance - first.hit!.distance).toBeCloseTo(1)
  })
  test('ignores hidden subtrees, hidden materials, zero-opacity transparency and inactive camera layers', () => {
    const hidden = new Group
    hidden.visible = false
    scene.add(hidden)
    hidden.add(box(-1, 'hidden-parent'))
    box(-1.5, 'hidden-mesh').visible = false
    box(-2, 'hidden-material').material.visible = false
    const transparent = box(-2.5, 'transparent')
    transparent.material.transparent = true
    transparent.material.opacity = 0
    box(-3, 'other-layer').layers.set(2)
    const target = box(-4, 'target')
    // A parent's layer does not suppress its children in Three's renderer.
    const parent = new Group
    parent.layers.set(2)
    scene.add(parent)
    parent.add(target)
    expect(inspector.getAim().hits.map(hit => hit.mesh.name)).toEqual(['target'])
    camera.layers.set(2)
    expect(inspector.getAim().hits.map(hit => hit.mesh.name)).toEqual(['other-layer'])
  })
  test('filters individual material groups before choosing the nearest mesh surface', () => {
    const materials = Array.from({length: 6}, () => new MeshBasicMaterial({side: DoubleSide}))
    materials[4].visible = false
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), materials)
    mesh.position.z = -2
    scene.add(mesh)
    const result = inspector.getAim()
    expect(result.hits).toHaveLength(1)
    expect(result.hit!.point.z).toBeCloseTo(-2.5)
    expect(result.hit!.material.index).toBe(5)
    expect(result.hit!.material.uuid).toBe(materials[5].uuid)
  })
  test('identifies separate instances and transforms their points and normals correctly', () => {
    const parent = new Group
    parent.position.set(1, 2, 0)
    parent.scale.set(2, 1, 0.5)
    const mesh = new InstancedMesh(new PlaneGeometry(2, 2), new MeshBasicMaterial, 2)
    const firstMatrix = new Matrix4
    firstMatrix.makeRotationY(Math.PI / 4).setPosition(0, 0, -6)
    mesh.setMatrixAt(0, firstMatrix)
    const secondMatrix = new Matrix4
    mesh.setMatrixAt(1, secondMatrix.makeTranslation(0, 0, -10))
    parent.add(mesh)
    scene.add(parent)
    camera.position.set(1, 2, 3)
    const result = inspector.getAim()
    expect(result.hits.map(hit => hit.instanceId)).toEqual([0, 1])
    expect(result.hit!.point).toEqual({
      x: 1,
      y: 2,
      z: -3,
    })
    expect(result.hit!.distance).toBeCloseTo(6)
    for (const component of Object.values(result.hit!.localPoint)) {
      expect(component).toBeCloseTo(0)
    }
    const world = parent.matrixWorld.clone().multiply(firstMatrix)
    const normalMatrix = new Matrix3
    const normal = new Vector3(0, 0, 1)
    normal.applyNormalMatrix(normalMatrix.getNormalMatrix(world))
    expect(result.hit!.normal!.x).toBeCloseTo(normal.x)
    expect(result.hit!.normal!.y).toBeCloseTo(normal.y)
    expect(result.hit!.normal!.z).toBeCloseTo(normal.z)
    expect(result.hits[1].point.z).toBeCloseTo(-5)
  })
  test('returns useful hierarchy metadata without leaking live or circular references', () => {
    const parent = new Group
    parent.name = 'vesper-wall'
    parent.userData = {
      wallId: 'vesper-east',
      room: 'vesper',
      nested: {ignored: true},
    }
    const mesh = box(-2, 'trim')
    mesh.userData = {
      portraitLabel: true,
      value: 42,
      unavailable: null,
      invalid: Number.NaN,
      parent,
    }
    parent.add(mesh)
    scene.add(parent)
    const result = inspector.getAim()
    expect(result.hit!.ancestors[0]).toMatchObject({
      name: 'vesper-wall',
      metadata: {
        wallId: 'vesper-east',
        room: 'vesper',
      },
    })
    expect(result.hit!.mesh.metadata).toEqual({
      portraitLabel: true,
      value: 42,
      unavailable: null,
    })
    expect(() => JSON.stringify(result)).not.toThrow()
    expect(structuredClone(result)).toEqual(result)
    result.hit!.mesh.metadata.value = 99
    expect(mesh.userData.value).toBe(42)
  })
  test('supports orthographic cameras, camera clipping distances and empty aim', () => {
    expect(inspector.getAim().hit).toBeNull()
    expect(inspector.getAim().hits).toEqual([])
    box(-0.2, 'near-clipped')
    box(-3, 'inside')
    box(-8, 'far-clipped')
    const orthographic = new OrthographicCamera(-2, 2, 2, -2, 1, 5)
    const orthoInspector = new AimInspector(scene, orthographic)
    expect(orthoInspector.getAim().hits.map(hit => hit.mesh.name)).toEqual(['inside'])
    orthographic.position.x = 5
    expect(orthoInspector.getAim().hit).toBeNull()
  })
})
