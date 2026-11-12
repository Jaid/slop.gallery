import {afterAll, expect, test} from 'bun:test'

import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {bastionCurve, lodgeSpurEndZ, lodgeSpurWidth, lodgeSpurWindow, lodgeSpurX} from '../../src/lib/gallery/bastion.ts'
import {bastionLink, insideBastion, lodgeSpur, lodgeSpurEnd, lodgeSpurGrille, lodgeSpurLanterns} from '../../src/lib/gallery/bastionNetwork.ts'
import gateGeometry from '../../src/lib/gallery/gateGeometry.ts'
import lodge, {lodgeEastWindow, lodgeWindow} from '../../src/lib/gallery/lodge.ts'
import LodgeEastWindowGeometry, {lodgeEastWindowMaterials} from '../../src/lib/gallery/LodgeEastWindowGeometry.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import {routePendantMounts} from '../../src/lib/gallery/pendants/mounts.ts'
import {openings} from '../../src/worlds/gallery/relations.ts'
import walls from './fixtures/gallery.ts'

const linkWall = walls.find(wall => wall.id === 'bastion-link_wall_5')!
const lodgeWall = walls.find(wall => wall.id === 'lodge-east')!
const window = new LodgeEastWindowGeometry
afterAll(() => window.dispose())
/** Raycast a particular architectural wall, with the same placement as WallSurface. */
const wallHit = (wall: typeof linkWall, from: [number, number, number], direction: [number, number, number]) => {
  const architecture = createArchitectureGeometry(wall)
  const material = new MeshBasicMaterial({side: DoubleSide})
  const mesh = new Mesh(architecture.surface, material)
  mesh.position.set(...wall.center)
  mesh.rotation.y = wall.rotation
  mesh.updateMatrixWorld(true)
  const ray = new Raycaster(new Vector3(...from), new Vector3(...direction), 0, 8)
  const hit = ray.intersectObject(mesh).at(0)
  architecture.dispose()
  material.dispose()
  return hit?.distance
}
test('the link wall at the marked point has a walkable bare arch leading into the side passage', () => {
  const hole = linkWall.holes!.find(value => value.name === 'lodge_spur')!
  expect(hole).toBeDefined()
  expect(hole.casing).toBe(false)
  expect(hole.width).toBeCloseTo(lodgeSpurWidth - 0.21, 8)
  const start = lodgeSpur.route.at(0)
  expect(start.point[0]).toBeCloseTo(lodgeSpurX, 9)
  expect(start.point[1]).toBeCloseTo(linkWall.center[2], 9)
  expect(start.y).toBeCloseTo(bastionLink.floorAt(lodgeSpurX, start.point[1])!, 7)
  // Its vault starts as tall as the link’s there, so their crowns meet over the doorway too.
  const linkStation = bastionLink.stationAt(...start.point)!
  expect(start.y + start.height).toBeCloseTo(linkStation.y + linkStation.height, 9)
  expect(wallHit(linkWall, [lodgeSpurX, start.y + 1.2, -28], [0, 0, -1])).toBeUndefined()
  expect(wallHit(linkWall, [lodgeSpurX - 3, start.y + 1.2, -28], [0, 0, -1])).toBeDefined()
})
test('the link’s junction roof is continuous across the doorway and faces into the passage', () => {
  const vault = new RouteVaultGeometry(bastionLink)
  const material = new MeshBasicMaterial({side: DoubleSide})
  vault.shell.boundsTree = new MeshBVH(vault.shell)
  const mesh = new Mesh(vault.shell, material)
  mesh.raycast = acceleratedRaycast
  const ray = new Raycaster(new Vector3, new Vector3(0, 1, 0), 0, 4)
  ray.firstHitOnly = true
  try {
    // A view across the intersection that a sliced rib could hang into.
    const direction = new Vector3(1.302, 0.59, -0.602)
    const reported = new Raycaster(new Vector3(-18.748, -3.21, -27.967), direction.normalize(), 0, 2)
    expect(reported.intersectObject(new Mesh(vault.ribs, material))).toHaveLength(0)
    // Dense columns cover both shoulders, the intersection and the roof beyond it, so no hole between the shell’s parts slips through.
    for (let x = lodgeSpurX - 1.8; x <= lodgeSpurX + 1.8; x += 0.035) {
      for (let z = -29.8; z <= -26.2; z += 0.035) {
        const floor = bastionLink.floorAt(x, z)!
        ray.ray.origin.set(x, floor + 0.3, z)
        const hit = ray.intersectObject(mesh)[0]
        expect(hit).toBeDefined()
        expect(hit.face!.normal.y).toBeLessThan(-0.01)
        expect(hit.point.y).toBeLessThan(-2.1)
      }
    }
  } finally {
    vault.dispose()
    material.dispose()
  }
})
test('the vaulted passage stays straight past the window and closes back to back with the existing northern passage’s wall', () => {
  const end = lodgeSpur.route.end
  expect(end.point[0]).toBeCloseTo(lodgeSpurX, 9)
  expect(end.point[1]).toBeLessThan(lodgeEastWindow.z - lodgeEastWindow.width / 2)
  expect(end.point[1]).toBeCloseTo(lodge.tunnelZ + lodge.passageWidth / 2, 9)
  expect(lodgeSpurEnd.center[2]).toBeCloseTo(end.point[1], 9)
  expect(end.heading).toBeCloseTo(-Math.PI / 2, 9)
  expect(end.y).toBe(-5)
  expect(lodgeSpur.floorAt(end.point[0], end.point[1] + 0.1)).toBeDefined()
  expect(lodgeSpur.floorAt(end.point[0], end.point[1] - 0.2)).toBeUndefined()
  expect(walls.some(wall => wall.id === lodgeSpurEnd.id)).toBe(true)
  // beside its window, halfway to the corner
  const besideWindow = (lodgeSpurWindow.width / 2 + lodgeSpurWidth / 2 - wallFace) / 2
  expect(wallHit(lodgeSpurEnd, [lodgeSpurX + besideWindow, end.y + 1.6, end.point[1] + 0.5], [0, 0, -1])).toBeDefined()
  expect(wallHit(lodgeSpurEnd, [lodgeSpurX, end.y + end.height - 0.01, end.point[1] + 0.5], [0, 0, -1])).toBeDefined()
  for (let along = 0.1; along < lodgeSpur.route.length - 0.1; along += 0.1) {
    const {point: [x, z], y} = lodgeSpur.route.at(along)
    expect(x).toBeCloseTo(lodgeSpurX, 9)
    expect(insideBastion([x, y + 1, z])).toBe(true)
    expect(lodgeSpur.floorAt(x, z)).toBeCloseTo(y, 7)
  }
  // The branch has its own vault, paving, ribs and a supported pendant lantern.
  const vault = new RouteVaultGeometry(lodgeSpur)
  try {
    expect(vault.paving.getAttribute('position').count).toBeGreaterThan(0)
    expect(vault.shell.getAttribute('position').count).toBeGreaterThan(0)
    expect(routePendantMounts(lodgeSpur, [vault.shell, vault.ribs], lodgeSpurLanterns)).toHaveLength(1)
  } finally {
    vault.dispose()
  }
})
test('a barred window goes on through the closing wall and the wall behind it, the run’s vault cut back to it everywhere else', () => {
  const back = bastionCurve.walls.find(wall => wall.holes?.some(hole => hole.name === 'lodge_spur_window'))!
  expect(back.center[2]).toBeCloseTo(lodgeSpurEndZ, 9)
  expect(Math.cos(back.rotation - lodgeSpurEnd.rotation)).toBeCloseTo(-1, 9)
  const hole = back.holes!.find(value => value.name === 'lodge_spur_window')!
  const [front] = lodgeSpurEnd.holes!
  // the same opening on both sides, its middle on the spur’s center line
  expect(back.center[0] + Math.cos(back.rotation) * hole.u).toBeCloseTo(lodgeSpurX, 9)
  expect(lodgeSpurEnd.center[0] + front.u).toBeCloseTo(lodgeSpurX, 9)
  expect(back.center[1] + hole.bottom!).toBeCloseTo(lodgeSpurEnd.center[1] + front.bottom!, 9)
  expect(back.center[1] + hole.height).toBeCloseTo(lodgeSpurEnd.center[1] + front.height, 9)
  expect([hole.width, hole.rise, hole.profile, hole.casing]).toEqual([front.width, front.rise, front.profile, front.casing])
  const face = lodgeSpurEndZ + wallFace
  const material = new MeshBasicMaterial({side: DoubleSide})
  const run = new RouteVaultGeometry(bastionCurve)
  const bars = gateGeometry(lodgeSpurGrille)
  const architectures = [lodgeSpurEnd, back].map(wall => [wall, createArchitectureGeometry(wall)] as const)
  try {
    const [closing, behind] = architectures.map(([wall, architecture]) => {
      const mesh = new Mesh(architecture.surface, material)
      mesh.position.set(...wall.center)
      mesh.rotation.y = wall.rotation
      mesh.updateMatrixWorld(true)
      return mesh
    })
    run.shell.boundsTree = new MeshBVH(run.shell)
    const shell = new Mesh(run.shell, material)
    shell.raycast = acceleratedRaycast
    const ribs = new Mesh(run.ribs, material)
    const ray = new Raycaster
    // Nothing of the run’s vault reaches through the closing wall into the spur.
    ray.far = 0.298
    for (let x = lodgeSpurX - lodgeSpurWidth / 2 + wallFace + 0.01; x < lodgeSpurX + lodgeSpurWidth / 2 - wallFace; x += 0.05) {
      for (let y = -4.95; y < -1.5; y += 0.05) {
        ray.ray.set(new Vector3(x, y, face + 0.3), new Vector3(0, 0, -1))
        expect(ray.intersectObject(shell)).toHaveLength(0)
      }
    }
    // Through the window, the view runs on into the run, past its middle.
    ray.far = 0.3 + wallFace + lodge.passageWidth * 0.6
    for (const share of [-0.4, 0, 0.4]) {
      for (const up of [lodgeSpurWindow.bottom + 0.05, 1.6, lodgeSpurWindow.height - lodgeSpurWindow.rise - 0.05]) {
        ray.ray.set(new Vector3(lodgeSpurX + share * lodgeSpurWindow.width, -5 + up, face + 0.3), new Vector3(0, 0, -1))
        expect(ray.intersectObjects([closing, behind, shell, ribs])).toHaveLength(0)
      }
    }
    // Beside it, both walls stand.
    ray.far = 8
    for (const side of [-1, 1]) {
      const x = lodgeSpurX + side * (lodgeSpurWindow.width / 2 + 0.05)
      ray.ray.set(new Vector3(x, -5 + 1.6, face + 0.3), new Vector3(0, 0, -1))
      expect(ray.intersectObject(closing)[0]?.distance).toBeCloseTo(0.3, 6)
      ray.ray.set(new Vector3(x, -5 + 1.6, lodgeSpurEndZ - 1), new Vector3(0, 0, 1))
      expect(ray.intersectObject(behind)[0]?.distance).toBeCloseTo(1 - wallFace, 6)
    }
    // The bars stand inside the closing wall, across the whole window.
    bars.computeBoundingBox()
    const {min, max} = bars.boundingBox!
    expect(min.z).toBeGreaterThan(lodgeSpurEndZ)
    expect(max.z).toBeLessThan(face)
    expect(min.x).toBeLessThan(lodgeSpurX - lodgeSpurWindow.width / 2)
    expect(max.x).toBeGreaterThan(lodgeSpurX + lodgeSpurWindow.width / 2)
    expect(min.y).toBeLessThan(-5 + lodgeSpurWindow.bottom)
    expect(max.y).toBeGreaterThan(-5 + lodgeSpurWindow.height)
  } finally {
    material.dispose()
    run.dispose()
    bars.dispose()
    for (const [, architecture] of architectures) {
      architecture.dispose()
    }
  }
})
test('the east Lodge wall opens to one matching glazed window, not another doorway', () => {
  const hole = lodgeWall.holes!.find(value => value.name === 'east_window')!
  expect(hole).toBeDefined()
  expect(hole.profile).toBe('rectangle')
  expect(hole.bottom).toBeCloseTo(lodgeEastWindow.bottom - -5, 8)
  expect(hole.width).toBe(lodgeWindow.width)
  expect(lodgeEastWindow.top).toBe(lodgeWindow.top)
  expect(wallHit(lodgeWall, [-18.9, -3, lodgeEastWindow.z], [-1, 0, 0])).toBeUndefined()
  expect(wallHit(lodgeWall, [-18.9, -3, lodgeEastWindow.z + 2], [-1, 0, 0])).toBeDefined()
  window.glass.computeBoundingBox()
  const pane = window.glass.boundingBox!
  expect(pane.min.x).toBeGreaterThan(lodgeEastWindow.x)
  expect(pane.max.x).toBeCloseTo(lodgeSpurX - lodgeSpurWidth / 2 + wallFace, 5)
  expect(pane.min.y).toBeCloseTo(lodgeEastWindow.bottom, 6)
  expect(pane.max.y).toBeCloseTo(lodgeEastWindow.top, 6)
  expect(pane.min.z).toBeCloseTo(lodgeEastWindow.z - lodgeEastWindow.width / 2, 5)
  const glassMesh = new Mesh(window.glass, new MeshBasicMaterial({side: DoubleSide}))
  try {
    const ray = new Raycaster(new Vector3(lodgeSpurX, -3, lodgeEastWindow.z), new Vector3(-1, 0, 0))
    expect(ray.intersectObject(glassMesh)[0]?.point.x).toBeCloseTo(lodgeSpurX - lodgeSpurWidth / 2 + wallFace, 5)
  } finally {
    glassMesh.material.dispose()
  }
  expect(openings).toContainEqual({
    rooms: ['bastion', 'lodge'],
    holes: [['lodge-east', 'east_window']],
  })
})
test('the east window’s Bastion side is faced in stone, with no timber showing on its wall', () => {
  const {z, width, bottom, top, border, sill} = lodgeEastWindow
  const face = lodgeSpurX - lodgeSpurWidth / 2 + wallFace
  const {groups, index} = window.lining
  // Every index belongs to exactly one material group, timber or stone.
  let covered = 0
  for (const group of groups.toSorted((a, b) => a.start - b.start)) {
    expect(group.start).toBe(covered)
    covered += group.count
  }
  expect(covered).toBe(index!.count)
  const positions = window.lining.getAttribute('position')
  const normals = window.lining.getAttribute('normal')
  const stoneBounds = {
    y: [Infinity, -Infinity],
    z: [Infinity, -Infinity],
  }
  let stoneFaces = 0
  for (const group of groups) {
    for (let i = group.start; i < group.start + group.count; i++) {
      const vertex = index!.getX(i)
      if (group.materialIndex === lodgeEastWindowMaterials.stone) {
        // Only the reveal’s ends on the passage’s face take the stone: every such vertex faces the Bastion and lies in its wall’s plane.
        expect([normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex)]).toEqual([1, 0, 0])
        expect(positions.getX(vertex)).toBeCloseTo(face, 5)
        stoneBounds.y = [Math.min(stoneBounds.y[0], positions.getY(vertex)), Math.max(stoneBounds.y[1], positions.getY(vertex))]
        stoneBounds.z = [Math.min(stoneBounds.z[0], positions.getZ(vertex)), Math.max(stoneBounds.z[1], positions.getZ(vertex))]
      } else {
        expect(group.materialIndex).toBe(lodgeEastWindowMaterials.timber)
      }
    }
    if (group.materialIndex === lodgeEastWindowMaterials.stone) {
      stoneFaces++
    }
  }
  // One stone end for each of the reveal’s four parts, together taking its whole outline around the opening.
  expect(stoneFaces).toBe(4)
  expect(stoneBounds.y[0]).toBeCloseTo(bottom - sill, 5)
  expect(stoneBounds.y[1]).toBeCloseTo(top + border, 5)
  expect(stoneBounds.z[0]).toBeCloseTo(z - width / 2 - border, 5)
  expect(stoneBounds.z[1]).toBeCloseTo(z + width / 2 + border, 5)
})
test('the entrance clears the parent vault and ribs at walking height, and the side window clears the spur', () => {
  const material = new MeshBasicMaterial({side: DoubleSide})
  const link = new RouteVaultGeometry(bastionLink)
  const spur = new RouteVaultGeometry(lodgeSpur)
  try {
    const start = lodgeSpur.route.at(0)
    for (const dx of [-0.6, 0, 0.6]) {
      const ray = new Raycaster(new Vector3(lodgeSpurX + dx, start.y + 1.7, -28), new Vector3(0, 0, -1), 0, 2.2)
      for (const geometry of [link.shell, link.ribs]) {
        expect(ray.intersectObject(new Mesh(geometry, material))).toHaveLength(0)
      }
      // Cutting the doorway must leave a connected roof, rather than an opening to the sky.
      for (const z of [-28.4, -29, -29.7]) {
        const up = new Raycaster(new Vector3(lodgeSpurX + dx, start.y + 1.7, z), new Vector3(0, 1, 0), 0, 1.25)
        expect(up.intersectObject(new Mesh(link.shell, material)).length).toBeGreaterThan(0)
      }
    }
    const ray = new Raycaster(new Vector3(lodgeSpurX, -3, lodgeEastWindow.z), new Vector3(-1, 0, 0), 0, 3.1)
    for (const geometry of [spur.shell, spur.ribs]) {
      expect(ray.intersectObject(new Mesh(geometry, material))).toHaveLength(0)
    }
    const side = lodgeSpur.walls.find(wall => wall.holes?.some(hole => hole.name === 'lodge_window'))!
    expect(wallHit(side, [lodgeSpurX, -3, lodgeEastWindow.z], [-1, 0, 0])).toBeUndefined()
  } finally {
    material.dispose()
    link.dispose()
    spur.dispose()
  }
})
