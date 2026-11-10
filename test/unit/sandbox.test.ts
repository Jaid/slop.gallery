import type {BufferGeometry} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {knotLightHousingSize, knotLightHousingY} from 'knot-materials/KnotLightPanels.ts'
import {DoubleSide, ExtrudeGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Raycaster, Shape, Vector3} from 'three/webgpu'

import {architectureGeometry, colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import {corniceBands, openingCasingFronts, wallFace, wallOpeningTrim} from '../../src/lib/gallery/architectureDimensions.ts'
import CellCeilingGeometry, {cellCeilingSlab, cellChandelierPivot, cellCoffers, cellLedY, cellOculus, cellRidge, cellSkylights, cofferLine, isCellSkylight} from '../../src/lib/gallery/CellCeilingGeometry.ts'
import CellDoorGeometry from '../../src/lib/gallery/CellDoorGeometry.ts'
import {columnPedestalRadius} from '../../src/lib/gallery/ColumnPedestalGeometry.ts'
import withOpeningReveals from '../../src/lib/gallery/openingReveals.ts'
import roundRevealGeometry from '../../src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape} from '../../src/lib/gallery/roundVestibule.ts'
import {chandelierCanopyTop, chandelierLampY, chandelierPhysics} from '../../src/lib/physics/chandelier.ts'
import {defaultPortraitArea, portraitRatios} from '../../src/lib/placement/portraitSlots.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import {orbs, promptOrbs} from '../../src/orbs/index.ts'
import cellBaseboard, {cellBaseboardHeight} from '../../src/rooms/cell/baseboard.ts'
import Cell, {cellLed} from '../../src/rooms/cell/Cell.ts'
import CellLayout from '../../src/rooms/cell/CellLayout.ts'
import cellMap from '../../src/rooms/cell/map.ts'
import RoomMap from '../../src/rooms/lib/RoomMap.ts'
import artworks from '../../src/worlds/gallery/artworks.ts'
import {readWorld} from '../../src/worlds/index.ts'
import {readItems} from '../../src/worlds/sandbox/items.ts'
import {moonDirection} from '../../src/worlds/sandbox/night.ts'
import Sandbox from '../../src/worlds/sandbox/Sandbox.ts'
import {readTurntable} from '../../src/worlds/sandbox/turntable.ts'

await RAPIER.init()
const ids = orbs.map(orb => orb.propId)
const distance = ([ax, az]: readonly [number, number], [bx, bz]: readonly [number, number]) => Math.hypot(ax - bx, az - bz)
describe('?item', () => {
  test('names the Sandbox’s items by their object ids, comma-separated, trimmed and in their order, as often as each is named', () => {
    expect(readItems('http://localhost/')).toEqual([])
    expect(readItems('?item=prop-orb-spook')).toEqual(['prop-orb-spook'])
    expect(readItems('?item=prop-orb-spook,prop-orb-halloween')).toEqual(['prop-orb-spook', 'prop-orb-halloween'])
    expect(readItems('?item=%20b%20,,a,b,')).toEqual(['b', 'a', 'b'])
  })
  test('also come as a list in the packed permalink state, which overrides the query’s', () => {
    const data = Buffer.from(JSON.stringify({item: ['prop-orb-horror', 'prop-orb-spook']})).toBase64()
    expect(readItems(`?data=${data}`)).toEqual(['prop-orb-horror', 'prop-orb-spook'])
    expect(readItems(`?item=prop-orb-halloween#data:${data}`)).toEqual(['prop-orb-horror', 'prop-orb-spook'])
  })
  test('shows among the query overrides as given, and not at all without items', () => {
    expect(readQueryOverrides('http://localhost/?item=')).toBeUndefined()
    expect(readQueryOverrides('http://localhost/?item=prop-orb-spook,%20prop-orb-horror')).toEqual({item: 'prop-orb-spook,prop-orb-horror'})
  })
  test('puts every orb it names on a pedestal of its own, in their order, and refuses ids it doesn’t know', () => {
    const sandbox = new Sandbox(['prop-orb-horror', 'prop-orb-spook'])
    expect(sandbox.items.map(item => item.id)).toEqual(['prop-orb-horror', 'prop-orb-spook'])
    expect(sandbox.items.map(item => item.orb.propId)).toEqual(['prop-orb-horror', 'prop-orb-spook'])
    expect(sandbox.room('cell').room.layout.pedestals).toHaveLength(2)
    expect(() => new Sandbox(['prop-orb-spook', 'prop-orb-pumpkin', 'prop-orb-pumpkin'])).toThrow('Unknown Sandbox item URL selection: prop-orb-pumpkin.')
  })
  test('puts a repeated orb on a pedestal of its own each time, every one a prop with an id of its own', () => {
    const spook = orbs.find(orb => orb.id === 'spook')!
    const sandbox = new Sandbox(readItems('?item=prop-orb-spook,prop-orb-horror,prop-orb-spook,prop-orb-spook'))
    expect(sandbox.items.map(item => item.id)).toEqual(['prop-orb-spook', 'prop-orb-horror', 'prop-orb-spook-2', 'prop-orb-spook-3'])
    expect(sandbox.items.filter(item => item.orb === spook)).toHaveLength(3)
    expect(sandbox.room('cell').room.layout.pedestals).toHaveLength(4)
    const triple = new Sandbox(readItems('?item=prop-orb-spook,prop-orb-spook,prop-orb-spook'))
    expect(triple.room('cell').room.layout.plan).toBe('rotunda')
    expect(triple.room('cell').room.layout.pedestals).toHaveLength(3)
  })
})
describe('?turntable', () => {
  test('asks for an artwork of the catalog, an image URL or the catalog’s first, with its ratio and frame area if given', () => {
    expect(readTurntable('http://localhost/')).toBeUndefined()
    expect(readTurntable('?turntable=false')).toBeUndefined()
    expect(readTurntable('?turntable')).toEqual({
      artwork: '',
      aspect: undefined,
      area: undefined,
    })
    expect(readTurntable('?turntable=true')).toEqual({
      artwork: '',
      aspect: undefined,
      area: undefined,
    })
    expect(readTurntable('?turntable=%20dog%20&turntable_ratio=3:2&turntable_area=30000')).toEqual({
      artwork: 'dog',
      aspect: 1.5,
      area: 30_000,
    })
    expect(readTurntable('?turntable=dog&turntable_ratio=0.75')?.aspect).toBe(0.75)
    for (const ratio of ['3:0', '-1', 'wide', '1:2:3']) {
      expect(readTurntable(`?turntable=dog&turntable_ratio=${ratio}`)?.aspect).toBeUndefined()
    }
    expect(readTurntable('?turntable=dog&turntable_area=-5')?.area).toBeUndefined()
  })
  test('opens the Sandbox and shows among the query overrides as given', () => {
    expect(readWorld('http://localhost/?turntable=dog')).toBe('sandbox')
    expect(readQueryOverrides('http://localhost/?turntable=dog&turntable_ratio=16:9&turntable_area=7500')).toEqual({
      turntable: 'dog',
      turntable_ratio: 16 / 9,
      turntable_area: 7500,
    })
  })
  test('floats the work in place of the east wall’s middle one, in its catalog ratio unless one is asked for, and refuses what is neither an artwork nor a URL', () => {
    const plain = new Sandbox([])
    expect(plain.turntable).toBeUndefined()
    const slot = plain.turntableSlot()
    expect(plain.portraitSlots().map(entry => entry.id)).toContain(slot.id)
    const sandbox = new Sandbox([], {
      artwork: '',
      aspect: undefined,
      area: undefined,
    })
    expect(sandbox.turntable).toEqual({
      id: artworks[0].id,
      source: artworks[0].source,
      aspect: portraitRatios[artworks[0].ratio],
      area: defaultPortraitArea,
    })
    expect(sandbox.portraitSlots().map(entry => entry.id)).not.toContain(slot.id)
    expect(sandbox.portraitSlots()).toHaveLength(plain.portraitSlots().length - 1)
    const dog = new Sandbox([], {
      artwork: 'dog',
      aspect: 1.5,
      area: 7500,
    })
    expect(dog.turntable).toMatchObject({
      id: 'dog',
      aspect: 1.5,
      area: 7500,
    })
    const image = new Sandbox([], {
      artwork: 'https://example.com/work.png',
      aspect: undefined,
      area: undefined,
    })
    expect(image.turntable).toEqual({
      id: 'https://example.com/work.png',
      source: 'https://example.com/work.png',
      aspect: undefined,
      area: defaultPortraitArea,
    })
    expect(() => new Sandbox([], {
      artwork: 'gooze',
      aspect: undefined,
      area: undefined,
    })).toThrow('Unknown Sandbox turntable artwork: gooze.')
  })
})
test('every orb with a prompt brings a JPEG XL photograph of itself for the portal of its fusions, in its own folder', async () => {
  for (const orb of promptOrbs) {
    expect(orb.photo.replaceAll('\\', '/')).toEndWith(`/orbs/${orb.id}/photo.jxl`)
    const bytes = await Bun.file(orb.photo).bytes()
    // A bare JPEG XL codestream.
    expect([...bytes.subarray(0, 2)]).toEqual([0xFF, 0x0A])
  }
})
describe('the Cell’s layout', () => {
  test('follows the number of items: a door for none, a vestibule for one, a rotunda for more', () => {
    const plan = (count: number) => {
      const layout = new CellLayout(count)
      return layout.plan
    }
    expect([0, 1, 2, 3, 4, 5, 12].map(plan)).toEqual(['closed', 'single', 'rotunda', 'rotunda', 'rotunda', 'rotunda', 'rotunda'])
    expect(() => new CellLayout(-1)).toThrow(RangeError)
    expect(() => new CellLayout(1.5)).toThrow(RangeError)
    const closed = new CellLayout(0)
    expect(closed.vestibule).toBeUndefined()
    expect(closed.pedestals).toEqual([])
  })
  test('lays its floor in whole tiles of 50 cm from wall to wall', () => {
    const layout = new CellLayout(0)
    expect(layout.floorTile).toBe(0.5)
    for (const side of layout.size) {
      expect(Number.isInteger(side / layout.floorTile)).toBe(true)
    }
  })
  test('stands a lone item in the middle of its vestibule, facing the arch', () => {
    const layout = new CellLayout(1)
    const vestibule = layout.vestibule!
    expect(vestibule.radius).toBe(4)
    expect(vestibule.center).toEqual([0, layout.northZ - layout.passage - 4])
    expect(vestibule.arches).toEqual([{
      name: 'cell',
      angle: Math.PI / 2,
    }])
    expect(layout.pedestals).toEqual([{
      position: vestibule.center,
      rotation: 0,
    }])
  })
  test('lights the round room with an LED panel in the middle of its ceiling, and none while the door is shut', () => {
    const closed = new Sandbox([])
    expect(closed.lamps().map(lamp => lamp.id)).toEqual(['cell-chandelier'])
    for (const count of [1, 2, 3, 6]) {
      const {layout, lamps} = new Cell(new CellLayout(count))
      expect(lamps.keys().toArray()).toEqual(['chandelier', 'led'])
      const led = lamps.get('led')!
      const [x, z] = layout.vestibule!.center
      expect(led.position).toEqual([x, cellLedY(layout.roundHeight) - cellLed.drop, z])
      expect(led.shadow).toBe(true)
      expect(led.kind ?? 'point').toBe('point')
      // It reaches across the whole round room, however large.
      expect(led.range!).toBeGreaterThanOrEqual(layout.vestibule!.radius * 2)
    }
  })
  for (const count of [2, 3, 4, 5, 6, 8, 12]) {
    test(`rings ${count} items round the rotunda’s middle, far apart, with a broad floor round and behind them, the ring open toward the arch`, () => {
      const layout = new CellLayout(count)
      const vestibule = layout.vestibule!
      expect(vestibule.center[0]).toBe(0)
      expect(vestibule.center[1] + vestibule.radius).toBeCloseTo(layout.northZ - layout.passage, 9)
      // Much larger than the lone item’s vestibule.
      expect(vestibule.radius).toBeGreaterThanOrEqual(6)
      const ring = distance(layout.pedestals[0].position, vestibule.center)
      expect(ring).toBeGreaterThanOrEqual(3.2 - 1e-9)
      expect(vestibule.radius - ring).toBeCloseTo(3, 6)
      for (const [index, {position, rotation}] of layout.pedestals.entries()) {
        expect(distance(position, vestibule.center)).toBeCloseTo(ring, 6)
        for (const other of layout.pedestals.slice(index + 1)) {
          expect(distance(position, other.position)).toBeGreaterThanOrEqual(4 - 1e-9)
        }
        // A side faces the middle.
        const [x, z] = position
        expect(Math.cos((rotation - Math.atan2(vestibule.center[0] - x, vestibule.center[1] - z)) * 4)).toBeCloseTo(1, 9)
        // None stands in the way from the arch to the middle.
        expect(Math.abs(x) > vestibule.arch.width / 2 + columnPedestalRadius.foot || z < vestibule.center[1]).toBe(true)
      }
      // Left and right of the middle alike.
      const xs = layout.pedestals.map(({position: [x]}) => x)
      expect(xs.reduce((sum, x) => sum + x, 0)).toBeCloseTo(0, 6)
    })
  }
  test('draws its map from what lies beyond the north wall, framing the round room and a column for every item', () => {
    for (const count of [0, 1, 2, 3, 6]) {
      const layout = new CellLayout(count)
      const {vestibule} = layout
      const svg = cellMap(layout)
      const map = new RoomMap(svg)
      const [x, z, width, depth] = map.frame
      const xs = [-layout.size[0] / 2, layout.size[0] / 2, ...vestibule ? [vestibule.center[0] - vestibule.radius, vestibule.center[0] + vestibule.radius] : []]
      const zs = [-layout.size[1] / 2, ...vestibule ? [vestibule.center[1] - vestibule.radius] : []]
      expect(x).toBeCloseTo(Math.min(...xs), 4)
      expect(x + width).toBeCloseTo(Math.max(...xs), 4)
      expect(z).toBeCloseTo(Math.min(...zs), 4)
      expect(z + depth).toBeCloseTo(layout.size[1] / 2, 4)
      expect(svg.match(/<circle /gu) ?? []).toHaveLength((vestibule ? 1 : 0) + layout.pedestals.length)
      expect(svg.match(/<rect /gu) ?? []).toHaveLength(count ? 0 : 1)
    }
  })
})
describe('the passage from the Cell’s hall to its round room', () => {
  test('keeps every floor level in the hall’s plane, so all of them mirror in one, and stands the round wall on it higher than the hall’s', () => {
    for (const count of [1, 3]) {
      const sandbox = new Sandbox(ids.slice(0, count))
      const cell = sandbox.room('cell')
      const {layout} = cell.room
      const vestibule = layout.vestibule!
      const north = sandbox.walls.find(wall => wall.id === 'cell-north')!
      const round = sandbox.walls.filter(wall => wall.curveRadius)
      expect(round.map(wall => wall.id)).toEqual(['cell-vestibule'])
      expect(round[0].center[1]).toBe(north.center[1])
      expect(north.height).toBe(layout.height)
      expect(round[0].height).toBe(layout.roundHeight)
      expect(layout.roundHeight).toBeGreaterThan(layout.height)
      expect(round[0].holes!.map(hole => [hole.name, hole.height])).toEqual([['cell', layout.arch.height]])
      for (const z of [layout.northZ + 2, layout.northZ, layout.northZ - layout.passage / 2, vestibule.center[1]]) {
        const position = cell.toWorld([vestibule.center[0], 1, z])
        expect(sandbox.floorHeight(position)).toBe(0)
        expect(sandbox.placement.floorHeight(position)).toBe(0)
        expect(sandbox.roomAt(position)).toBe(cell)
        expect(sandbox.contains(position)).toBe(true)
      }
      // Beside it lies nothing.
      expect(sandbox.placement.contains(cell.toWorld([vestibule.center[0] + layout.arch.width / 2 + 0.3, 1, layout.northZ - layout.passage / 2]))).toBe(false)
    }
  })
  test('lines the passage with the reveal of the round room’s arch, from its wall on to the north wall’s center line, where the north wall’s own reveal takes over, between the jambs of the arch through the north wall and up to its crown', () => {
    const sandbox = new Sandbox(ids.slice(0, 1))
    const cell = sandbox.room('cell')
    const {layout} = cell.room
    const ring = sandbox.walls.find(wall => wall.id === 'cell-vestibule')!
    const hole = ring.holes!.find(candidate => candidate.name === 'cell')!
    const reveal = roundRevealGeometry(ring, hole, layout.vestibule!.arch, layout.passage).rotateY(ring.rotation).translate(...ring.center)
    const north = sandbox.walls.find(wall => wall.id === 'cell-north')!
    const lined = withOpeningReveals(architectureGeometry(north).surface, north)
    try {
      reveal.computeBoundingBox()
      const {min, max} = reveal.boundingBox!
      const [archX, , centerLine] = cell.toWorld([layout.vestibule!.center[0], 0, layout.northZ])
      expect(max.z).toBeCloseTo(centerLine, 6)
      // The north wall lines its own opening only from its center line out to its face, so the passage’s reveal has to meet it there.
      const [, revealGroup] = lined.groups
      const wallPosition = lined.getAttribute('position')
      const along: Array<number> = []
      for (let index = revealGroup.start; index < revealGroup.start + revealGroup.count; index++) {
        along.push(wallPosition.getZ(lined.index!.getX(index)))
      }
      expect(Math.min(...along)).toBeCloseTo(0, 6)
      expect(Math.max(...along)).toBeCloseTo(wallFace, 6)
      expect(min.x).toBeCloseTo(archX - layout.arch.width / 2, 6)
      expect(max.x).toBeCloseTo(archX + layout.arch.width / 2, 6)
      expect(min.y).toBeCloseTo(0, 6)
      expect(max.y).toBeCloseTo(layout.arch.height, 6)
      // Every face looks into the passage, toward its middle line.
      const position = reveal.getAttribute('position')
      const normal = reveal.getAttribute('normal')
      for (let index = 0; index < position.count; index++) {
        const towardMiddle = (archX - position.getX(index)) * normal.getX(index) + (layout.arch.height - layout.arch.width / 2 - position.getY(index)) * normal.getY(index)
        expect(towardMiddle).toBeGreaterThan(0)
      }
    } finally {
      reveal.dispose()
      lined.dispose()
    }
  })
  for (const sprint of [false, true]) {
    for (const returning of [false, true]) {
      test(`a player walks from the hall over the threshold board through the passage into the round room, sprint ${sprint}, returning ${returning}`, () => {
        const sandbox = new Sandbox(ids.slice(0, 1))
        const {layout} = sandbox.room('cell').room
        const vestibule = layout.vestibule!
        const [width, depth] = layout.size
        const world = new RAPIER.World({
          x: 0,
          y: -9.81,
          z: 0,
        })
        const fps = 60
        world.timestep = 1 / fps
        const ring = sandbox.walls.find(wall => wall.id === 'cell-vestibule')!
        // Built like CellRoom’s: the round room’s slab, the passage’s and the passage’s reveal, in world meters, the Cell standing at the world’s origin.
        const extrude = (shape: Shape) => {
          const geometry = new ExtrudeGeometry(shape, {
            depth: 0.24,
            bevelEnabled: false,
            curveSegments: 96,
          })
          return geometry.rotateX(-Math.PI / 2)
        }
        const lane = new Shape
        lane.moveTo(-layout.arch.width / 2, 0)
        lane.lineTo(layout.arch.width / 2, 0)
        lane.lineTo(layout.arch.width / 2, layout.passage)
        lane.lineTo(-layout.arch.width / 2, layout.passage)
        lane.closePath()
        const parts: Array<BufferGeometry> = [
          extrude(roundVestibuleFloorShape(vestibule)).translate(vestibule.center[0], 0.001 - 0.24, vestibule.center[1]),
          extrude(lane).translate(vestibule.center[0], 0.001 - 0.24, layout.northZ),
          roundRevealGeometry(ring, ring.holes!.find(hole => hole.name === 'cell')!, vestibule.arch, layout.passage).rotateY(ring.rotation).translate(...ring.center),
        ]
        const turn = new Quaternion
        for (const wall of sandbox.walls) {
          turn.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
          for (const args of architectureGeometry(wall).collision) {
            world.createCollider(RAPIER.ColliderDesc.trimesh(...args).setTranslation(...wall.center).setRotation(turn))
          }
        }
        for (const part of parts) {
          world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(part)))
        }
        world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, 0.12, depth / 2).setTranslation(0, 0.001 - 0.12, 0))
        const board = openingCasingFronts.classic + wallFace
        world.createCollider(RAPIER.ColliderDesc.cuboid(layout.arch.width / 2 + 0.01, 0.009, board / 2).setTranslation(vestibule.center[0], 0.001 + 0.009, layout.northZ + openingCasingFronts.classic - board / 2))
        // Straight through the arch and the passage, then beside the column’s place.
        const path: Array<readonly [x: number, z: number]> = [
          [vestibule.center[0], layout.northZ + 3],
          [vestibule.center[0], layout.northZ - layout.passage - 0.8],
          [vestibule.center[0] + 1.5, vestibule.center[1]],
        ]
        if (returning) {
          path.reverse()
        }
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(path[0][0], 0.04, path[0][1]))
        const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
        const motor = new EgoMotor(RAPIER, world, body, collider)
        const facing = new Quaternion
        try {
          let target = 1
          for (let i = 0; i < fps * 30 && target < path.length; i++) {
            const position = body.translation()
            const dx = path[target][0] - position.x
            const dz = path[target][1] - position.z
            if (Math.hypot(dx, dz) < Math.max(0.3, (sprint ? 8 : 3) / fps)) {
              target++
              continue
            }
            facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dx, -dz))
            motor.step(world.timestep, {
              forward: true,
              sprint,
            }, facing)
            world.step()
            // Never sinking through a gap in the floors on the way.
            expect(position.y).toBeGreaterThan(-0.02)
          }
          expect({
            target,
            position: body.translation(),
          }).toMatchObject({target: path.length})
          for (let i = 0; i < fps; i++) {
            motor.step(world.timestep, {}, facing)
            world.step()
          }
          expect(body.translation().y).toBeCloseTo(0.001 + 0.02, 2)
          expect(motor.grounded).toBe(true)
        } finally {
          motor.dispose()
          world.free()
          for (const part of parts) {
            part.dispose()
          }
        }
      })
    }
  }
})
describe('the Cell’s trim and door', () => {
  test('runs a molded baseboard along the round room’s wall, which stands out of the face less than the plain bands, and the Sienna’s plain bands along the hall’s, both 20 cm high, the velvet lining the arch through the north one', () => {
    const [toe] = cellBaseboard
    const top = cellBaseboard.at(-1)!
    expect(toe).toEqual([toe[0], 0])
    expect(top[0]).toBe(wallFace)
    expect(cellBaseboardHeight).toBe(0.2)
    expect(top[1]).toBeCloseTo(cellBaseboardHeight, 9)
    expect(Math.max(...cellBaseboard.map(([, y]) => y))).toBeCloseTo(cellBaseboardHeight, 9)
    expect(Math.max(...cellBaseboard.map(([front]) => front))).toBeLessThan(0.2)
    for (const count of [0, 1, 3]) {
      const sandbox = new Sandbox(ids.slice(0, count))
      const round = sandbox.walls.filter(wall => wall.curveRadius)
      const hall = sandbox.walls.filter(wall => !wall.curveRadius)
      expect(round).toHaveLength(sandbox.room('cell').room.layout.vestibule ? 1 : 0)
      expect(hall.map(wall => wall.id).toSorted()).toEqual(['cell-east', 'cell-north', 'cell-south', 'cell-west'])
      for (const wall of round) {
        expect(wall.baseboardSection).toBe(cellBaseboard)
      }
      for (const wall of hall) {
        expect(wall.baseboardSection).toBeUndefined()
        const {surface, trim: [trim]} = architectureGeometry(wall)
        trim.computeBoundingBox()
        // The Sienna’s two plain bands, apart from the plinth blocks the casing of an opening stands on.
        if (!wall.holes?.length) {
          expect(trim.boundingBox!.max.y).toBeCloseTo(cellBaseboardHeight, 6)
          continue
        }
        // The arch’s reveal, all of it inside the opening and across from the wall’s faces, takes the second material.
        const lined = withOpeningReveals(surface, wall)
        try {
          const [faces, reveals] = lined.groups
          expect(faces.start).toBe(0)
          expect(reveals.start).toBe(faces.count)
          expect(faces.count + reveals.count).toBe(lined.index!.count)
          expect(reveals.count).toBeGreaterThan(0)
          const [hole] = wall.holes
          const position = lined.getAttribute('position')
          for (let index = reveals.start; index < reveals.start + reveals.count; index++) {
            const corner = lined.index!.getX(index)
            expect(Math.abs(position.getX(corner) - hole.u)).toBeLessThanOrEqual(hole.width / 2 + 0.01)
            expect(position.getY(corner)).toBeLessThanOrEqual(hole.height + 0.01)
          }
        } finally {
          lined.dispose()
        }
      }
    }
    const lone = new Sandbox(ids.slice(0, 1))
    const ring = lone.walls.find(wall => wall.curveRadius)!
    expect(() => withOpeningReveals(architectureGeometry(ring).surface, ring)).toThrow(RangeError)
  })
  test('refuses baseboard sections that sink into the wall, run downward or end off its face', () => {
    const sandbox = new Sandbox([])
    const [wall] = sandbox.walls
    const cut = (baseboardSection: ReadonlyArray<readonly [number, number]>) => () => architectureGeometry({
      ...wall,
      baseboardSection,
    })
    expect(cut([[0.1, 0], [wallFace, 0.1]])).toThrow(RangeError)
    expect(cut([[0.15, 0], [0.15, 0.1], [0.14, 0.05], [wallFace, 0.12]])).toThrow(RangeError)
    expect(cut([[0.15, 0], [0.12, 0.1]])).toThrow(RangeError)
  })
  test('fills the opening it closes, a little into the wall round it, without reaching out past its casing', () => {
    const sandbox = new Sandbox([])
    const north = sandbox.walls.find(wall => wall.id === 'cell-north')!
    const hole = north.holes!.find(candidate => candidate.name === 'door')!
    const door = new CellDoorGeometry(hole)
    try {
      for (const part of [door.lacquer, door.velvet, door.brass]) {
        part.computeBoundingBox()
      }
      const {min, max} = door.lacquer.boundingBox!
      expect(max.x).toBeGreaterThan(hole.width / 2)
      expect(min.x).toBeLessThan(-hole.width / 2)
      expect(max.y).toBeGreaterThan(hole.height)
      expect(min.y).toBeGreaterThan(0)
      for (const part of [door.lacquer, door.velvet, door.brass]) {
        expect(part.boundingBox!.max.z).toBeLessThan(0.27)
        expect(part.boundingBox!.min.z).toBeGreaterThanOrEqual(-1e-6)
        expect(Math.abs(part.boundingBox!.max.x)).toBeLessThan(hole.width / 2 + 0.02)
      }
    } finally {
      door.dispose()
    }
    expect(() => new CellDoorGeometry({
      ...hole,
      profile: 'rectangle',
    })).toThrow(RangeError)
  })
})
describe('the Cell’s ceilings', () => {
  test('rise from the hall’s north and south walls to a ridge along its middle like a house’s roof, and hang level over the round room', () => {
    const layout = new CellLayout(1)
    const [width, depth] = layout.size
    expect([layout.height, layout.ridgeHeight]).toEqual([4, 9])
    expect(layout.ridgeHeight).toBeCloseTo(layout.height + depth / 2 * Math.tan(layout.roofPitch), 9)
    expect(layout.ceilingAt(0, depth / 2)).toBeCloseTo(layout.height, 9)
    expect(layout.ceilingAt(width / 2, -depth / 2)).toBeCloseTo(layout.height, 9)
    expect(layout.ceilingAt(-3, 0)).toBeCloseTo(layout.ridgeHeight, 9)
    expect(layout.ceilingAt(4, 2)).toBeCloseTo(layout.ceilingAt(4, -2), 9)
    expect(layout.ceilingAt(0, 2) - layout.ceilingAt(0, 3)).toBeCloseTo(Math.tan(layout.roofPitch), 9)
    expect(layout.ceilingAt(...layout.vestibule!.center)).toBe(layout.roundHeight)
    // The hall’s air reaches up to the ridge, and a body fits under the slopes but not through them.
    const sandbox = new Sandbox(ids.slice(0, 1))
    const cell = sandbox.room('cell')
    expect(cell.room.bounds.max.y).toBeCloseTo(layout.ridgeHeight, 9)
    expect(sandbox.contains(cell.toWorld([0, layout.ridgeHeight - 1, 0]))).toBe(true)
    expect(sandbox.contains(cell.toWorld([0, layout.ridgeHeight - 1, depth / 2 - 1]))).toBe(false)
    expect(sandbox.contains(cell.toWorld([layout.vestibule!.center[0], layout.roundHeight - 0.5, layout.vestibule!.center[1]]))).toBe(true)
    expect(sandbox.contains(cell.toWorld([layout.vestibule!.center[0], layout.roundHeight + 0.5, layout.vestibule!.center[1]]))).toBe(false)
  })
  test('coffer both slopes in nearly square fields of equal size between the rafters and purlins, from the cornice at the eaves up to the ridge beam and from gable to gable', () => {
    const layout = new CellLayout(0)
    const [width, depth] = layout.size
    const {beam, count: [countX, countSlope]} = cellCoffers
    const length = depth / 2 / Math.cos(layout.roofPitch)
    const sides = [
      [width, countX, [wallFace + beam.width, wallFace + beam.width]],
      [length, countSlope, [cellRidge.width / 2 / Math.cos(layout.roofPitch), 0.34 / Math.cos(layout.roofPitch)]],
    ] as const
    const fields = sides.map(([size, count, [start, end]]) => {
      const {beams, field, middles} = cofferLine(size, count, [start, end])
      expect(middles).toHaveLength(count)
      expect(beams).toHaveLength(count - 1)
      expect(middles[0] - field / 2).toBeCloseTo(-size / 2 + start, 9)
      expect(middles.at(-1)! + field / 2).toBeCloseTo(size / 2 - end, 9)
      for (const [index, middle] of beams.entries()) {
        expect(middle - beam.width / 2).toBeCloseTo(middles[index] + field / 2, 9)
        expect(middle + beam.width / 2).toBeCloseTo(middles[index + 1] - field / 2, 9)
      }
      return field
    })
    expect(Math.abs(fields[0] - fields[1]) / fields[0]).toBeLessThan(0.04)
  })
  test('glaze every coffer up both slopes but those along the gables, the eave and the ridge, open through the slab inside the gilt fillet and divided into panes by the sash’s bars', () => {
    const layout = new CellLayout(1)
    const geometry = new CellCeilingGeometry(layout)
    const material = new MeshBasicMaterial({side: DoubleSide})
    try {
      const [width] = layout.size
      const {beam, count: [countX, countSlope], fillet} = cellCoffers
      const {inset, panes, sash} = cellSkylights
      expect(inset).toBeGreaterThan(fillet.inset + fillet.width)
      expect(geometry.skylights).toHaveLength((countX - 2) * (countSlope - 2))
      const alongX = cofferLine(width, countX, [wallFace + beam.width, wallFace + beam.width])
      const alongSlope = cofferLine(geometry.length, countSlope, [cellRidge.width / 2 / Math.cos(layout.roofPitch), 0.34 / Math.cos(layout.roofPitch)])
      const opening = [alongX.field - inset * 2, alongSlope.field - inset * 2] as const
      const across = cofferLine(opening[0], panes[0], [sash.frame, sash.frame], sash.bar)
      const down = cofferLine(opening[1], panes[1], [sash.frame, sash.frame], sash.bar)
      const slab = new Mesh(geometry.slab, material)
      const glass = new Mesh(geometry.glass, material)
      const rails = new Mesh(geometry.sash, material)
      // Laid along x and turned down the slope by the mesh, like the rafters.
      const stiles = new Mesh(geometry.sashStiles, material)
      stiles.rotation.y = Math.PI / 2
      stiles.updateMatrixWorld()
      /** What a ray straight up through the point of a slope’s underside meets first. */
      const first = (x: number, z: number) => {
        const ray = new Raycaster(new Vector3(x, -0.01, z), new Vector3(0, 1, 0))
        return ray.intersectObjects([slab, glass, rails, stiles], false)[0]?.object
      }
      for (const [column, x] of alongX.middles.entries()) {
        for (const [row, z] of alongSlope.middles.entries()) {
          const glazed = isCellSkylight(column, row)
          expect(geometry.skylights.some(([skylightX, skylightZ]) => Math.abs(skylightX - x) + Math.abs(skylightZ - z) < 1e-9)).toBe(glazed)
          if (!glazed) {
            expect(first(x, z)).toBe(slab)
            continue
          }
          // Every pane shows the sky through its glass alone.
          for (const paneX of across.middles) {
            for (const paneZ of down.middles) {
              expect(first(x + paneX, z + paneZ)).toBe(glass)
            }
          }
          // The bars between the panes and the frame round them are in its way, and the slab just outside the opening, under the fillet.
          expect(first(x + across.beams[0], z + down.middles[1])).toBe(stiles)
          expect(first(x + across.middles[1], z + down.beams[0])).toBe(rails)
          expect(first(x + opening[0] / 2 - 0.01, z)).toBe(stiles)
          expect(first(x, z + opening[1] / 2 - 0.01)).toBe(rails)
          expect(first(x + opening[0] / 2 + 0.003, z)).toBe(slab)
          expect(first(x, z - opening[1] / 2 - 0.003)).toBe(slab)
        }
      }
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })
  test('pierce both gables with a round window over the middle of the hall, clear of the cornice and of the rafters under the slopes, and glaze it', () => {
    const layout = new CellLayout(0)
    const geometry = new CellCeilingGeometry(layout)
    const material = new MeshBasicMaterial({side: DoubleSide})
    try {
      const [width] = layout.size
      const {casing, radius, rise} = cellOculus
      const middle = layout.height + rise
      const outer = radius + casing.width
      // Over the cornice at the top of the walls, and clear of the rafter along the gable under the slopes, which meet over its middle.
      expect(middle - outer).toBeGreaterThan(layout.height + 0.3)
      const underside = layout.ridgeHeight - cellCeilingSlab / 2
      expect((underside - middle) * Math.cos(layout.roofPitch) - cellCoffers.beam.depth).toBeGreaterThan(outer + 0.2)
      const gables = new Mesh(geometry.gables, material)
      const panes = new Mesh(geometry.oculusGlass, material)
      for (const side of [-1, 1]) {
        // From the middle of the hall at the height of the window: its middle and the inside of its opening show only glass, just outside it the gable.
        for (const [z, y, expected] of [[0, middle, panes], [0, middle + radius - 0.05, panes], [radius * 0.7, middle - radius * 0.7, panes], [0, middle + outer + 0.05, gables]] as const) {
          const origin = new Vector3(0, y, z)
          const ray = new Raycaster(origin, new Vector3(side, 0, 0))
          const hits = ray.intersectObjects([gables, panes], false)
          expect(hits[0]?.object).toBe(expected)
          if (expected !== panes) {
            continue
          }
          expect(hits.some(hit => hit.object === gables)).toBe(false)
          expect(hits[0].point.x * side).toBeGreaterThan(width / 2 - 0.105)
        }
      }
      // The casing reaches out round the opening, its gilt bead in its groove.
      geometry.oculi.computeBoundingBox()
      expect(geometry.oculi.boundingBox!.max.y).toBeCloseTo(middle + outer, 2)
      geometry.oculusGilt.computeBoundingBox()
      expect(geometry.oculusGilt.boundingBox!.max.y).toBeLessThan(middle + outer)
      expect(geometry.oculusGilt.boundingBox!.max.y).toBeGreaterThan(middle + radius)
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })
  test('let the moon shine onto the hall’s floor through the roof lights’ glass and nowhere else, and show the night sky over the Cell', () => {
    const layout = new CellLayout(1)
    const geometry = new CellCeilingGeometry(layout)
    const material = new MeshBasicMaterial({side: DoubleSide})
    const walls = new PlaneGeometry(1, 1)
    try {
      const [width, depth] = layout.size
      const shell = new Group
      const glass: Array<Mesh> = []
      for (const {position, rotation} of geometry.slopes) {
        const slope = new Group
        slope.position.set(...position)
        slope.rotation.copy(rotation)
        const rafters = new Mesh(geometry.crossBeams, material)
        rafters.rotation.y = Math.PI / 2
        const panes = new Mesh(geometry.glass, material)
        slope.add(new Mesh(geometry.slab, material), new Mesh(geometry.beams, material), rafters, panes)
        glass.push(panes)
        shell.add(slope)
      }
      const oculi = new Mesh(geometry.oculusGlass, material)
      glass.push(oculi)
      shell.add(new Mesh(geometry.ridge, material), new Mesh(geometry.gables, material), oculi)
      // The walls along their center lines, up to the ceiling.
      for (const [x, z, turn, span] of [[width / 2, 0, Math.PI / 2, depth], [-width / 2, 0, Math.PI / 2, depth], [0, depth / 2, 0, width], [0, -depth / 2, 0, width]] as const) {
        const wall = new Mesh(walls, material)
        wall.scale.set(span, layout.height, 1)
        wall.position.set(x, layout.height / 2, z)
        wall.rotation.y = turn
        shell.add(wall)
      }
      shell.updateMatrixWorld(true)
      const opaque = shell.children.flatMap(child => (child instanceof Mesh ? [child] : child.children)).filter(child => !glass.includes(child as Mesh))
      const toMoon = new Vector3(...moonDirection)
      toMoon.normalize()
      let lit = 0
      let samples = 0
      for (let x = -width / 2 + 0.5; x < width / 2; x += 1) {
        for (let z = -depth / 2 + 0.5; z < depth / 2; z += 1) {
          samples++
          const ray = new Raycaster(new Vector3(x, 0.01, z), toMoon)
          if (ray.intersectObjects(opaque, false).length > 0) {
            continue
          }
          lit++
          // Out under the sky only through a pane.
          expect(ray.intersectObjects(glass, false).length).toBeGreaterThan(0)
        }
      }
      // Low in the south-southwest, the moon lights the north-eastern walls more than the floor.
      expect(lit / samples).toBeGreaterThan(0.03)
      expect(lit / samples).toBeLessThan(0.6)
      const sandbox = new Sandbox(ids.slice(0, 1))
      const cell = sandbox.room('cell')
      expect(cell.skybox).toBe('night')
      expect(sandbox.skybox('night')).not.toBeNull()
      expect(sandbox.skybox('sky')).toBeNull()
      expect(cell.volumetricSun).toBeGreaterThan(0)
    } finally {
      geometry.dispose()
      material.dispose()
      walls.dispose()
    }
  })
  for (const count of [0, 1, 2, 4, 12]) {
    test(`lays both slopes from the eaves’ wall tops to the ridge, the beams, sashes and gilding under them, the gables up to them and the plate the chandelier’s rod hangs from under the ridge beam, with ${count} items`, () => {
      const layout = new CellLayout(count)
      const geometry = new CellCeilingGeometry(layout)
      try {
        const underside = layout.height - cellCeilingSlab / 2
        const apex = layout.ridgeHeight - cellCeilingSlab / 2
        const [width, depth] = layout.size
        const half = geometry.length / 2
        expect(geometry.length).toBeCloseTo(depth / 2 / Math.cos(layout.roofPitch), 9)
        // A slope’s own frame: x along the hall, z down from the ridge to the eave, its underside at y = 0.
        for (const part of [geometry.slab, geometry.beams, geometry.crossBeams, geometry.gilt, geometry.sash, geometry.glass]) {
          part.computeBoundingBox()
        }
        // The sashes and their glass within the slab, a little under its top.
        for (const part of [geometry.sash, geometry.glass]) {
          expect(part.boundingBox!.min.y).toBeGreaterThan(0)
          expect(part.boundingBox!.max.y).toBeLessThan(cellCeilingSlab - cellSkylights.sash.top + 1e-6)
        }
        expect(geometry.slab.boundingBox!.min.y).toBeCloseTo(0, 6)
        expect(geometry.slab.boundingBox!.max.y).toBeCloseTo(cellCeilingSlab, 6)
        expect(geometry.slab.boundingBox!.max.z).toBeCloseTo(half, 6)
        const beams = geometry.beams.boundingBox!
        expect(beams.max.y).toBeCloseTo(0, 6)
        expect(beams.min.y).toBeCloseTo(-cellCoffers.beam.depth, 6)
        expect(beams.max.x).toBeCloseTo(width / 2, 6)
        // A purlin along the eave closes the coffers’ lowest row, as the ridge beam closes their highest.
        const alongSlope = cofferLine(geometry.length, cellCoffers.count[1], [cellRidge.width / 2 / Math.cos(layout.roofPitch), 0.34 / Math.cos(layout.roofPitch)])
        expect(beams.max.z).toBeCloseTo(alongSlope.middles.at(-1)! + alongSlope.field / 2 + cellCoffers.beam.width, 6)
        expect(beams.max.z).toBeLessThan(half)
        // Laid along x, the mesh turns them down the slope: local x becomes the slope’s −z and local z its x.
        const cross = geometry.crossBeams.boundingBox!
        expect(cross.min.x).toBeCloseTo(-half, 6)
        expect(cross.max.x).toBeCloseTo(half, 6)
        expect(cross.max.z).toBeCloseTo(width / 2 - wallFace, 6)
        expect(cross.min.y).toBeCloseTo(beams.min.y, 6)
        const gilt = geometry.gilt.boundingBox!
        expect(gilt.min.y).toBeGreaterThan(beams.min.y)
        expect(gilt.max.y).toBeLessThan(cellCeilingSlab)
        // Each slope runs from the wall’s center line at its eave, where the walls end, up to the ridge.
        const [south, north] = geometry.slopes.map(({position, rotation}) => {
          const matrix = new Matrix4
          const turn = new Quaternion
          return matrix.compose(new Vector3(...position), turn.setFromEuler(rotation), new Vector3(1, 1, 1))
        })
        const at = (matrix: Matrix4, z: number) => {
          const point = new Vector3(0, 0, z)
          return point.applyMatrix4(matrix)
        }
        for (const [matrix, side] of [[south, 1], [north, -1]] as const) {
          const eave = at(matrix, half)
          const ridge = at(matrix, -half)
          expect(eave.y).toBeCloseTo(underside, 9)
          expect(eave.z).toBeCloseTo(side * depth / 2, 9)
          expect(ridge.y).toBeCloseTo(apex, 9)
          expect(ridge.z).toBeCloseTo(0, 9)
          // The underside faces down into the hall.
          const normal = new Vector3(0, -1, 0)
          normal.transformDirection(matrix)
          expect(normal.y).toBeCloseTo(-Math.cos(layout.roofPitch), 9)
          expect(Math.sign(normal.z)).toBe(-side)
        }
        // Over the arch through the north wall and its casing everywhere.
        expect(underside - cellCoffers.beam.depth).toBeGreaterThan(layout.arch.height + wallOpeningTrim + 0.2)
        for (const part of [geometry.ridge, geometry.plate, geometry.gables]) {
          part.computeBoundingBox()
        }
        expect(geometry.ridge.boundingBox!.max.y).toBeCloseTo(apex, 6)
        expect(geometry.ridge.boundingBox!.min.y).toBeCloseTo(apex - cellRidge.depth, 6)
        // The plate reaches into the ridge beam, and the ball at the top of the chandelier’s rod tucks into it from under it.
        const plate = geometry.plate.boundingBox!
        const pivot = cellChandelierPivot(layout.ridgeHeight)
        expect(plate.max.y).toBeCloseTo(apex - cellRidge.depth + 0.002, 6)
        expect(plate.min.y).toBeCloseTo(pivot, 6)
        // The rod reaches down from the ball to the top of the fixture, which hangs its lamp under the tops of the walls, well over the visitors’ heads.
        const canopyTop = layout.chandelierLift + chandelierPhysics.height + chandelierCanopyTop
        expect(canopyTop + layout.chandelierRod).toBeCloseTo(pivot, 9)
        expect(layout.chandelierRod).toBeGreaterThan(1)
        expect(layout.chandelierLift + chandelierLampY).toBeLessThan(underside)
        expect(layout.chandelierLift + chandelierLampY).toBeGreaterThan(3)
        // Standing just out of the walls’ faces, from the top of their cornice up to the slopes, which cover their sloping edges.
        const gables = geometry.gables.boundingBox!
        expect(gables.min.x).toBeCloseTo(-width / 2, 6)
        expect(gables.max.x).toBeCloseTo(width / 2, 6)
        expect(gables.min.z).toBeCloseTo(-depth / 2, 6)
        expect(gables.max.z).toBeCloseTo(depth / 2, 6)
        expect(gables.min.y).toBeCloseTo(layout.height - Math.min(...corniceBands.map(band => band.drop - band.height / 2)), 6)
        expect(gables.max.y).toBeGreaterThan(apex)
        expect(gables.max.y).toBeLessThan(apex + cellCeilingSlab / Math.cos(layout.roofPitch))
        const gablePosition = geometry.gables.getAttribute('position')
        for (let index = 0; index < gablePosition.count; index++) {
          expect(Math.abs(gablePosition.getX(index))).toBeGreaterThanOrEqual(width / 2 - wallFace - 0.002 - 1e-6)
        }
        if (layout.vestibule) {
          const roundUnderside = layout.roundHeight - cellCeilingSlab / 2
          geometry.rounds.computeBoundingBox()
          expect(geometry.rounds.boundingBox!.min.y).toBeCloseTo(roundUnderside, 6)
          geometry.roundGilt.computeBoundingBox()
          expect(geometry.roundGilt.boundingBox!.max.y).toBeLessThan(roundUnderside + 0.03)
          // The panel’s housing reaches 5 mm into the slab, over the round room’s middle.
          expect(cellLedY(layout.roundHeight) + knotLightHousingY + knotLightHousingSize[1] / 2).toBeCloseTo(roundUnderside + 0.005, 9)
        } else {
          expect(geometry.rounds.getAttribute('position')).toBeUndefined()
          expect(geometry.roundGilt.getAttribute('position')).toBeUndefined()
        }
      } finally {
        geometry.dispose()
      }
    })
  }
})
