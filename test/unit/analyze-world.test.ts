import type {WorldRoom} from '../../src/lib/webmcp/analyzeWorld.ts'

import {expect, test} from 'bun:test'

import {AmbientLight, BoxGeometry, DirectionalLight, Group, InstancedMesh, Matrix4, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PointLight, Scene, SpotLight} from 'three/webgpu'

import worldTables from '../../scripts/lib/worldTables.ts'
import {lodgeBay} from '../../src/lib/gallery/lodge.ts'
import {craterTerrain} from '../../src/lib/gallery/moonfall/CraterTerrain.ts'
import {siennaVestibule} from '../../src/lib/gallery/sienna.ts'
import InstancedPropVisuals from '../../src/lib/physics/InstancedPropVisuals.ts'
import {registerLamp} from '../../src/lib/rendering/lamps.ts'
import {ShadowPool} from '../../src/lib/rendering/shadowPool.ts'
import analyzeWorld from '../../src/lib/webmcp/analyzeWorld.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const square = (id: string, x: number): WorldRoom => ({
  id,
  title: id,
  fence: {
    min: [x - 5, 0, -5],
    max: [x + 5, 4, 5],
  },
})
test('every gallery room is fenced around its origin', () => {
  const worldRooms = slopGallery.worldRooms()
  expect(worldRooms.map(room => room.id)).toEqual(slopGallery.rooms.map(room => room.id))
  const boxes = Object.fromEntries(worldRooms.map(room => [room.id, [room.fence].flat()]))
  // Single boxes stay unwrapped.
  expect(Array.isArray(worldRooms.find(room => room.id === 'vesper')!.fence)).toBe(false)
  // The passage round the Lodge’s bay and down the long hall, the diagonal stair flight, and the landing before the Sienna’s vestibule, which belongs to the Sienna.
  expect(boxes.corridor.length).toBeGreaterThan(9)
  expect(boxes.sienna).toHaveLength(2)
  expect(boxes.sienna[1].min[0]).toBeCloseTo(siennaVestibule.center[0] - siennaVestibule.size[0] / 2)
  expect(boxes.sienna[1].max[1]).toBe(siennaVestibule.height)
  expect(Math.max(...boxes.corridor.filter(box => box.max[2] > 0).map(box => box.max[0]))).toBeCloseTo(boxes.sienna[1].min[0])
  // The Corridor and the Lodge meet halfway through the doorway passage between them, north of the bay.
  expect(boxes.lodge).toHaveLength(3)
  expect(boxes.corridor.filter(({min, max}) => max[2] === boxes.lodge[1].min[2] && min[0] === boxes.lodge[1].min[0] && max[0] === boxes.lodge[1].max[0])).toHaveLength(1)
  expect(boxes.lodge[1].max[2]).toBe(boxes.lodge[2].min[2])
  // The Lodge’s bay lies north of its square, as wide and as high.
  expect(boxes.lodge[2].max[2]).toBe(boxes.lodge[0].min[2])
  expect(boxes.lodge[2].min[2]).toBeCloseTo(boxes.lodge[0].min[2] - lodgeBay.depth)
  expect([boxes.lodge[2].min[0], boxes.lodge[2].max[0], boxes.lodge[2].min[1], boxes.lodge[2].max[1]]).toEqual([boxes.lodge[0].min[0], boxes.lodge[0].max[0], boxes.lodge[0].min[1], boxes.lodge[0].max[1]])
  // The Bastion now wraps around the Lodge and crosses above its roof.
  expect(Math.min(...boxes.bastion.map(box => box.min[0]))).toBeLessThan(boxes.lodge[0].min[0])
  expect(Math.max(...boxes.bastion.map(box => box.max[0]))).toBeGreaterThan(boxes.lodge[0].max[0])
  expect(boxes.bastion.some(box => box.min[0] === boxes.lodge[0].max[0])).toBe(true)
  // The Moonfall reaches down into its crater, deeper than its floor.
  const moonfall = slopGallery.room('moonfall')
  expect(boxes.moonfall[0].min[1]).toBeCloseTo(moonfall.floorY + craterTerrain.lowest(), 3)
  expect(boxes.moonfall[0].min[1]).toBeLessThan(moonfall.floorY - 3)
  expect(boxes.moonfall[0].max[1]).toBeCloseTo(moonfall.floorY + 5.8, 3)
  for (const room of slopGallery.rooms) {
    const [x, y, z] = room.origin
    expect(boxes[room.id].some(({min, max}) => x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2])).toBe(true)
  }
})
test('meshes land in the room holding most of their volume and spill into the others', () => {
  const scene = new Scene
  const material = new MeshStandardNodeMaterial({name: 'plaster'})
  const group = new Group
  group.name = 'west'
  const box = new Mesh(new BoxGeometry, material)
  box.name = 'box'
  box.position.set(0, 1, 0)
  group.add(box)
  // Centered on the boundary both rooms share, so the earlier room wins the tie.
  const wall = new Mesh(new BoxGeometry, new MeshStandardNodeMaterial)
  wall.name = 'wall'
  wall.position.set(5, 1, 0)
  const instanced = new InstancedMesh(new BoxGeometry, [material, new MeshStandardNodeMaterial, new MeshBasicNodeMaterial], 3)
  const matrix = new Matrix4
  for (const [i, x] of [1, 9, 11].entries()) {
    instanced.setMatrixAt(i, matrix.makeTranslation(x, 1, 1))
  }
  // Far below the west floor, like a crater’s bottom.
  const crater = new Mesh(new BoxGeometry, material)
  crater.name = 'crater'
  crater.position.set(0, -10, 0)
  const outside = new Mesh(new BoxGeometry, new MeshStandardNodeMaterial)
  outside.name = 'outside'
  outside.position.set(30, 1, 0)
  const hidden = new Mesh(new BoxGeometry, material)
  hidden.visible = false
  const lamp = new PointLight('#ff8000', 3, 6, 2)
  // Above the ceiling, like a skylight’s lamp.
  lamp.position.set(10, 30, 0)
  scene.add(group, wall, instanced, crater, outside, hidden, lamp, new AmbientLight)
  const analysis = analyzeWorld(scene, [square('west', 0), square('east', 10)])
  expect(Object.keys(analysis.rooms)).toEqual(['west', 'east'])
  expect(analysis.rooms.west).not.toHaveProperty('id')
  const {west, east} = analysis.rooms
  expect(west.meshes.map(mesh => [mesh.path, mesh.spill])).toEqual([['west/box', undefined], ['wall', 'east'], ['crater', undefined]])
  expect(west.meshes[0].material).toBe('plaster')
  expect(west.meshes[0]).not.toHaveProperty('instances')
  expect(west.meshes[1]).not.toHaveProperty('material')
  expect(east.meshes).toEqual([{
    path: 'Mesh',
    instances: 3,
    // Plain MeshStandardNodeMaterials are left out.
    material: ['plaster', 'MeshBasicNodeMaterial'],
    spill: 'west',
    triangles: 36,
  }])
  expect(analysis.elsewhere.meshes).toEqual([{
    path: 'outside',
    triangles: 12,
  }])
  expect(east.lights).toHaveLength(1)
  expect(east.lights[0]).toMatchObject({
    type: 'PointLight',
    position: [10, 30, 0],
    color: '#ff8000',
    intensity: 3,
    distance: 6,
    decay: 2,
  })
  expect(analysis.globalLights.map(light => light.type)).toEqual(['AmbientLight'])
})
test('each room lists the lights of other regions its room lists leave on', () => {
  const scene = new Scene
  const lamp = (name: string, x: number, lightRooms?: Array<string>) => {
    const light = new PointLight
    light.name = name
    light.position.set(x, 2, 0)
    if (lightRooms) {
      registerLamp(light, {
        id: name,
        optional: false,
        rooms: lightRooms,
      })
    }
    scene.add(light)
    return light
  }
  lamp('everywhere', 0)
  lamp('west-only', 0, ['west'])
  lamp('seen-from-east', 0, ['west', 'east'])
  lamp('passage', 30, ['east'])
  // The shadow pool’s slots only stand in for other lights.
  lamp('slot', 0).userData.shadowSlot = true
  const {west, east} = analyzeWorld(scene, [square('west', 0), square('east', 10)]).rooms
  expect(west.foreignLights).toEqual([])
  expect(east.foreignLights).toEqual([
    {
      path: 'everywhere',
      room: 'west',
    },
    {
      path: 'seen-from-east',
      room: 'west',
    },
    {path: 'passage'},
  ])
})
test('pickups and the batch instances drawing them are items of the room holding their origin, apart from the static meshes', () => {
  const scene = new Scene
  const geometry = new BoxGeometry
  const material = new MeshStandardNodeMaterial
  const pedestal = new Mesh(geometry, material)
  pedestal.name = 'pedestal'
  // Carried over the boundary, mostly into the east room, but its origin is still in the west.
  const prop = new Group
  prop.name = 'prop-orb'
  prop.userData = {
    pickup: true,
    propId: 'prop-orb',
  }
  prop.position.set(4.5, 1, 0)
  prop.add(new Mesh(geometry, material), new Mesh(geometry, material))
  prop.children[1].position.x = 5
  const portrait = new Group
  portrait.userData = {
    pickup: true,
    portraitId: 'cat',
  }
  portrait.position.set(30, 1, 0)
  portrait.add(new Mesh(geometry, material))
  // A nameplate drawn by instanced batches, with an empty pickup that moves it; the second instance’s prop isn’t in the scene.
  const sign = new Group
  sign.userData = {
    pickup: true,
    propId: 'sign-a',
  }
  sign.position.set(10, 0, 0)
  const faces = new InstancedMesh(geometry, material, 2)
  const supports = new InstancedMesh(geometry, material, 2)
  const instance = new Matrix4
  for (const mesh of [faces, supports]) {
    mesh.setMatrixAt(0, instance.makeTranslation(10, 0, 0))
    mesh.setMatrixAt(1, instance.makeTranslation(0, 0, 0))
  }
  new InstancedPropVisuals([faces, supports], ['sign-a', 'sign-b'])
  scene.add(pedestal, prop, portrait, sign, faces, supports)
  const analysis = analyzeWorld(scene, [square('west', 0), square('east', 10)])
  const {west, east} = analysis.rooms
  expect(west.meshes.map(mesh => mesh.path)).toEqual(['pedestal'])
  expect(east.meshes).toEqual([])
  expect(west.items).toEqual([
    {
      id: 'prop-orb',
      meshes: 2,
      triangles: 24,
    },
    {
      id: 'sign-b',
      meshes: 2,
      triangles: 24,
    },
  ])
  expect(east.items).toEqual([{
    id: 'sign-a',
    meshes: 2,
    triangles: 24,
  }])
  expect(analysis.elsewhere.items).toEqual([{
    id: 'cat',
    meshes: 1,
    triangles: 12,
  }])
})
test('lights tell a shadow map of their own from one borrowed from the shadow pool, whose slots are left out', () => {
  const scene = new Scene
  const plain = new PointLight
  const pooled = new PointLight
  pooled.userData.shadow = true
  const spot = new SpotLight
  spot.castShadow = true
  const sun = new DirectionalLight
  sun.castShadow = true
  const pool = new ShadowPool(2)
  scene.add(plain, pooled, spot, sun, ...pool.slots)
  const analysis = analyzeWorld(scene, [square('west', 0)])
  expect(analysis.rooms.west.lights.map(light => [light.type, light.shadow])).toEqual([['PointLight', undefined], ['PointLight', 'pooled'], ['SpotLight', 'own']])
  expect(analysis.globalLights.map(light => [light.type, light.shadow])).toEqual([['DirectionalLight', 'own']])
})
/** a region of meshes, items and lights with these triangles and shadows */
const region = (meshes: Array<number>, items: Array<number>, shadows: Array<'own' | 'pooled' | undefined>) => ({
  meshes: meshes.map((triangles, index) => ({
    path: `mesh-${index}`,
    triangles,
  })),
  items: items.map((triangles, index) => ({
    id: `item-${index}`,
    meshes: 1,
    triangles,
  })),
  lights: shadows.map(shadow => ({
    type: 'PointLight',
    path: 'lamp',
    position: [0, 0, 0] as [number, number, number],
    color: '#ffffff',
    intensity: 1,
    ...shadow ? {shadow} : {},
  })),
})
test('the tables split static meshes from items, leave rooms without items out of theirs and count lamps and shadows', () => {
  const fence = {
    min: [0, 0, 0] as [number, number, number],
    max: [1, 1, 1] as [number, number, number],
  }
  const markdown = worldTables({
    rooms: {
      hall: {
        title: 'Hall',
        fence,
        ...region([12_000, 300], [], [undefined]),
        foreignLights: [],
      },
      salon: {
        title: 'Salon',
        fence,
        ...region([20_000], [100, 50], ['own', 'pooled', undefined]),
        foreignLights: [],
      },
    },
    elsewhere: region([], [8], []),
    globalLights: region([], [], ['own', undefined]).lights,
  }, 'Test', 'heavy', 1)
  expect(markdown).toStartWith('## Test (heavy graphics, seed 1)\n')
  const section = (name: string) => markdown.split(`### ${name}`)[1].split('###')[0]
  expect(section('static meshes')).toContain('| Salon | 20\u{202F}000 | 1 |\n| Hall | 12\u{202F}300 | 2 |\n| **total** | 32\u{202F}300 | 3 |')
  expect(section('static meshes')).not.toContain('Elsewhere')
  expect(section('items')).toContain('| Salon | 150 | 2 |\n| Elsewhere | 8 | 1 |\n| **total** | 158 | 3 |')
  expect(section('items')).not.toContain('Hall')
  expect(section('lights')).toContain('| room | lamps | shadows |')
  expect(section('lights')).toContain('| Salon | 3 | 2 |\n| Hall | 1 |  |\n| Global | 2 | 1 |\n| **total** | 6 | 3 |')
})
test('against a base revision, the tables tell the changes, matching rooms by title and counting those only one revision has as empty in the other', () => {
  const fence = {
    min: [0, 0, 0] as [number, number, number],
    max: [1, 1, 1] as [number, number, number],
  }
  const analysis = (rooms: Record<string, ReturnType<typeof region> & {title: string}>, elsewhere = region([], [], [])) => ({
    rooms: Object.fromEntries(Object.entries(rooms).map(([id, room]) => [id, {
      ...room,
      fence,
      foreignLights: [],
    }])),
    elsewhere,
    globalLights: region([], [], ['own']).lights,
  })
  const markdown = worldTables(analysis({
    hall: {
      title: 'Hall',
      ...region([12_000, 300], [], [undefined]),
    },
    salon: {
      title: 'Salon',
      ...region([20_000], [100], ['own']),
    },
  }), 'Test', 'heavy', 1, analysis({
    hall: {
      title: 'Hall',
      ...region([12_000, 300], [50], [undefined]),
    },
    // Renamed to the Salon since, so it counts as gone.
    parlor: {
      title: 'Parlor',
      ...region([500], [], [undefined]),
    },
  }))
  const section = (name: string) => markdown.split(`### ${name}`)[1].split('###')[0]
  expect(section('static meshes')).toContain('<th colspan="2">triangles</th><th colspan="2">meshes</th>')
  expect(section('static meshes')).toContain('<tr><td>Salon</td><td align="right">20\u{202F}000</td><td align="right">+20\u{202F}000</td><td align="right">1</td><td align="right">+1</td></tr>')
  expect(section('static meshes')).toContain('<tr><td>Hall</td><td align="right">12\u{202F}300</td><td align="right"></td><td align="right">2</td><td align="right"></td></tr>')
  expect(section('static meshes')).toContain('<tr><td>Parlor</td><td align="right"></td><td align="right">−500</td><td align="right"></td><td align="right">−1</td></tr>')
  // The Hall lost its only item, but stays in the table to tell so.
  expect(section('items')).toContain('<tr><td>Hall</td><td align="right"></td><td align="right">−50</td><td align="right"></td><td align="right">−1</td></tr>')
  expect(section('items')).toContain('<tr><td><b>total</b></td><td align="right">100</td><td align="right">+50</td><td align="right">1</td><td align="right"></td></tr>')
  expect(section('lights')).toContain('<th colspan="2">lamps</th><th colspan="2">shadows</th>')
  expect(section('lights')).toContain('<tr><td>Global</td><td align="right">1</td><td align="right"></td><td align="right">1</td><td align="right"></td></tr>')
})
