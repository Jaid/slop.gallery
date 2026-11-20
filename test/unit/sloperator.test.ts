import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, expect, test} from 'bun:test'

import {Box3} from 'three/webgpu'

import {lodgeSpur} from '../../src/lib/gallery/bastionNetwork.ts'
import Slop from '../../src/lib/gallery/curios/slop/Slop.ts'
import {fountainBench} from '../../src/lib/gallery/fountainBenches.ts'
import {probeGeofences, startGeofences, useGeofences} from '../../src/lib/gallery/geofences.ts'
import lodge, {lodgeEastWindow} from '../../src/lib/gallery/lodge.ts'
import lodgeInterior from '../../src/lib/gallery/lodgeInterior/layout.ts'
import UpholsteredSeatGeometry from '../../src/lib/gallery/lodgeInterior/UpholsteredSeatGeometry.ts'
import {salonBench} from '../../src/lib/gallery/salon.ts'
import {sightSloperator, useSloperator} from '../../src/lib/gallery/sloperator/sightings.ts'
import sights, {slopRandom} from '../../src/lib/gallery/sloperator/sights.ts'
import SloperatorGeometry from '../../src/lib/gallery/sloperator/SloperatorGeometry.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import SlopMaterial from '../../src/lib/materials/SlopMaterial.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const {armchairSpread, seatWidth} = lodgeInterior
const {armHeight, armRollRadius, armWidth, backHeight, depth, seatHeight} = UpholsteredSeatGeometry
const sight = (id: typeof sights[number]['id']) => sights.find(candidate => candidate.id === id)!
const armchair = sight('lodge_armchair')
const still: Vec3 = [0, 0, 0]
/** where a standing player’s place is in the knight’s alley, in the connecting tunnel in front of its doorway, in the Salon, in the Banquet, in the Forge and in the Lobby */
const places = {
  alley: [-16.93, -4.1, -33],
  link: [-16.93, -4.3, -28],
  salon: [14, 0.9, -24],
  banquet: [14, 0.9, -10],
  forge: [-14, 0.9, -24],
  lobby: [0, 0.9, 0],
} satisfies Record<string, Vec3>
/** The box round all of him. */
const boxOf = (figure: SloperatorGeometry) => {
  const box = new Box3
  for (const part of [figure.cloth, figure.skin, figure.slime]) {
    box.union(part.boundingBox!)
  }
  return box
}
const sighting = (id: typeof sights[number]['id']) => ({
  sight: id,
  distance: 5,
  position: [1, 2, 3] satisfies Vec3,
})
afterEach(() => {
  useGeofences.setState(useGeofences.getInitialState(), true)
  useSloperator.setState(useSloperator.getInitialState(), true)
  useGallery.setState({room: slopGallery.defaultRoom})
})
test('the Sloperator sits a meter tall in the armchair, between its arms, his feet on the floor in front of it', () => {
  const figure = new SloperatorGeometry(armchair.seat)
  const seat = new UpholsteredSeatGeometry(1, seatWidth + armchairSpread)
  try {
    for (const part of [figure.cloth, figure.skin, figure.slime]) {
      expect(Object.keys(part.attributes).toSorted()).toEqual(['normal', 'position', 'uv'])
    }
    const box = boxOf(figure)
    // From the seat cushion under him to the crown of his hat, which stands over everything else of him
    expect(SloperatorGeometry.height).toBe(1)
    expect(box.max.y).toBeCloseTo(seatHeight + SloperatorGeometry.height, 6)
    expect(figure.cloth.boundingBox!.max.y).toBeGreaterThan(figure.skin.boundingBox!.max.y)
    // His head and his shoulders stand over the back of the armchair, which hides the rest of him from behind.
    expect(figure.skin.boundingBox!.max.y).toBeGreaterThan(backHeight + 0.4)
    // His shoes stand on the floor, in front of the armchair, whose front edge his thighs reach to.
    expect(box.min.y).toBeCloseTo(0, 6)
    expect(box.max.z).toBeGreaterThan(depth / 2 + 0.2)
    expect(SloperatorGeometry.lap).toBeCloseTo(depth / 2, 1)
    // He leans against the back cushion without sinking into the frame behind it, and keeps between the outsides of the arms, his hands on their rolls.
    expect(box.min.z).toBeGreaterThan(-depth / 2 + 0.22)
    expect(box.max.x).toBeLessThan(seat.width / 2)
    expect(box.min.x).toBeCloseTo(-box.max.x, 6)
    expect(figure.skin.boundingBox!.max.x).toBeGreaterThan((seatWidth + armchairSpread) / 2)
    expect(figure.skin.boundingBox!.min.y).toBeGreaterThan(armHeight + armRollRadius * 0.7)
    expect(figure.skin.boundingBox!.max.x).toBeLessThan((seatWidth + armchairSpread) / 2 + armWidth)
    // The slop hangs in front of his face, under the brim of his hat.
    expect(figure.slime.boundingBox!.max.z).toBeGreaterThan(figure.skin.boundingBox!.min.z + 0.2)
    expect(figure.slime.boundingBox!.max.y).toBeLessThan(figure.cloth.boundingBox!.max.y - 0.1)
    expect(figure.slime.boundingBox!.min.y).toBeGreaterThan(seatHeight + 0.6)
    // A figure only ever seen from afar
    expect(triangleCount(figure.cloth) + triangleCount(figure.skin) + triangleCount(figure.slime)).toBeLessThan(12_000)
  } finally {
    figure.dispose()
    seat.dispose()
  }
})
test('on a seat without arms, he sits upright and as tall, his hands on his thighs', () => {
  for (const {seat} of [sight('lobby_bench'), sight('salon_ottoman')]) {
    expect(Object.keys(seat)).toEqual(['height'])
    const figure = new SloperatorGeometry(seat)
    const leaning = new SloperatorGeometry({
      ...seat,
      lean: 0.12,
    })
    try {
      const box = boxOf(figure)
      expect(box.min.y).toBeCloseTo(0, 6)
      expect(box.max.y).toBeCloseTo(seat.height + SloperatorGeometry.height, 6)
      // Upright, his back reaches less far behind him than leaning.
      expect(box.min.z).toBeGreaterThan(boxOf(leaning).min.z + 0.03)
      // His hands lie on his thighs, inside his shoulders, short of his knees, which reach just past the seat’s front edge.
      const hands = figure.skin.boundingBox!
      expect(hands.max.x).toBeLessThan(0.2)
      expect(hands.min.y).toBeGreaterThan(seat.height + 0.15)
      expect(hands.max.z).toBeLessThan(0.5)
      expect(hands.max.z).toBeGreaterThan(0.4)
      expect(box.max.x).toBeLessThan(0.32)
    } finally {
      figure.dispose()
      leaning.dispose()
    }
  }
})
test('a seat’s cushions lie where whoever sits on them finds them', () => {
  const seat = new UpholsteredSeatGeometry(1)
  try {
    expect(seatHeight).toBe(0.49)
    expect(seat.leather.boundingBox!.max.y).toBeCloseTo(backHeight, 6)
    expect(seat.leather.boundingBox!.max.x).toBeCloseTo(seat.width / 2 + UpholsteredSeatGeometry.armRollOffset + armRollRadius - armWidth / 2, 6)
  } finally {
    seat.dispose()
  }
})
test('every sight is a seat in a room of the gallery, seen from a fence of the gallery that does not hold it', () => {
  expect(sights.map(({id}) => id)).toEqual(['lodge_armchair', 'lobby_bench', 'salon_ottoman'])
  const fences = slopGallery.dumpGeofences().map(({id}) => id)
  for (const {fence, position: [x, y, z], room, seat} of sights) {
    expect(fences).toContain(fence)
    // Where he sits, his middle is in his seat’s room and out of the fence he is seen from, so nobody ever stands where he sits while he does.
    const around = slopGallery.geofences.getMatches([x, y + seat.height + 0.5, z])
    expect(around).toContain(room)
    expect(around).not.toContain(fence)
    expect(slopGallery.roomById(room)).toBeDefined()
  }
  expect(sights.map(({fence}) => fence)).toEqual(['knight_alley', 'salon', 'forge'])
})
test('his armchair stands in front of the Lodge’s east window, its back to it, where the knight’s alley sees his hat over the sill', () => {
  const [x, floorY, z] = armchair.position
  expect(floorY).toBe(lodge.floorY)
  expect(armchair.indoors).toBe(true)
  // In front of the window, inside the room, and facing away from it: the window is in the east wall.
  expect(Math.abs(z - lodgeEastWindow.z)).toBeLessThan(lodgeEastWindow.width / 2)
  expect(x).toBeLessThan(lodgeEastWindow.x - 1)
  expect(Math.sin(armchair.yaw)).toBeLessThan(-0.7)
  // A player standing in the middle of the alley in front of the window looks through it, over its sill, at the crown of his hat and the middle of his head.
  const eye = [lodgeSpur.route.start[0], lodge.floorY + 1.6, lodgeEastWindow.z] as const
  expect(slopGallery.geofences.getMatches([eye[0], eye[1] - 0.7, eye[2]])).toContain('knight_alley')
  for (const height of [seatHeight + SloperatorGeometry.height - 0.02, seatHeight + SloperatorGeometry.height - 0.22]) {
    const target = [x, lodge.floorY + height, z] as const
    const share = (lodgeEastWindow.x - eye[0]) / (target[0] - eye[0])
    const sillY = eye[1] + (target[1] - eye[1]) * share
    const acrossZ = eye[2] + (target[2] - eye[2]) * share
    expect(share).toBeGreaterThan(0)
    expect(share).toBeLessThan(1)
    expect(sillY).toBeGreaterThan(lodgeEastWindow.bottom)
    expect(sillY).toBeLessThan(lodgeEastWindow.top)
    expect(Math.abs(acrossZ - lodgeEastWindow.z)).toBeLessThan(lodgeEastWindow.width / 2)
  }
})
test('on the Lobby’s bench he faces the fountain from its south end, and on the Salon’s ottoman the sculpture, his thighs reaching to their front edges', () => {
  const bench = sight('lobby_bench')
  const ottoman = sight('salon_ottoman')
  // The bench east of the fountain, which he faces west to, a meter south of its middle
  expect(bench.position[0]).toBeCloseTo(4 + SloperatorGeometry.lap - fountainBench.depth / 2, 6)
  expect(bench.position[1]).toBe(0)
  expect(bench.position[2]).toBeCloseTo(-11, 6)
  expect(Math.sin(bench.yaw)).toBeCloseTo(-1, 6)
  expect(bench.seat.height).toBe(fountainBench.height)
  // Where his knees are, the bench’s front edge lies under them.
  expect(bench.position[0] - SloperatorGeometry.lap).toBeCloseTo(4 - fountainBench.depth / 2, 6)
  // The ottoman on the Salon’s axis, which he faces north on
  expect(ottoman.position[0]).toBe(salonBench.position[0])
  expect(ottoman.position[2] - SloperatorGeometry.lap).toBeCloseTo(salonBench.position[2] - salonBench.depth / 2, 6)
  expect(Math.cos(ottoman.yaw)).toBeCloseTo(-1, 6)
  expect(Math.abs(Math.sin(ottoman.yaw))).toBeLessThan(1e-9)
  expect(ottoman.seat.height).toBe(salonBench.seatHeight)
})
test('aiming at him changes nothing until the player leaves the sight’s fence, where he then leaves a Slop and never returns', () => {
  const states: Array<ReturnType<typeof useSloperator.getState>> = []
  const stop = useSloperator.subscribe(state => states.push(state))
  startGeofences(places.link)
  probeGeofences(places.alley, still)
  expect(useGeofences.getState().fences).toContain('knight_alley')
  // Leaving without having caught sight of him leaves everything as it was.
  probeGeofences(places.link, still)
  probeGeofences(places.alley, still)
  expect(states).toEqual([])
  const first = sighting('lodge_armchair')
  expect(sightSloperator(first)).toBe(true)
  // Only the first sight of him at a sight counts.
  expect(sightSloperator({
    ...first,
    distance: 2,
  })).toBe(false)
  probeGeofences([-16.93, -4.1, -34], still)
  expect(states).toEqual([{
    sighted: [first],
    slopped: [],
  }])
  probeGeofences(places.link, still)
  expect(useSloperator.getState()).toEqual({
    sighted: [],
    slopped: ['lodge_armchair'],
  })
  // Back in the alley, there is nothing left to catch sight of.
  probeGeofences(places.alley, still)
  expect(sightSloperator(first)).toBe(false)
  probeGeofences(places.link, still)
  expect(states).toHaveLength(2)
  stop()
})
test('each sight goes by its own fence, a room’s too, and a start elsewhere leaves a sight caught waiting', () => {
  startGeofences(places.salon)
  expect(sightSloperator(sighting('lobby_bench'))).toBe(true)
  startGeofences(places.forge)
  expect(sightSloperator(sighting('salon_ottoman'))).toBe(true)
  // A player who starts anew elsewhere has left no fence.
  startGeofences(places.lobby)
  expect(useSloperator.getState().slopped).toEqual([])
  expect(useSloperator.getState().sighted.map(({sight: id}) => id)).toEqual(['lobby_bench', 'salon_ottoman'])
  // Into the Salon and out through the arch into the Banquet: only the bench’s sight goes by the Salon’s fence.
  probeGeofences(places.salon, still)
  expect(useSloperator.getState().slopped).toEqual([])
  probeGeofences(places.banquet, still)
  expect(useGeofences.getState().fences).not.toContain('salon')
  expect(useSloperator.getState()).toEqual({
    sighted: [sighting('salon_ottoman')],
    slopped: ['lobby_bench'],
  })
  probeGeofences(places.forge, still)
  probeGeofences(places.lobby, still)
  expect(useSloperator.getState()).toEqual({
    sighted: [],
    slopped: ['lobby_bench', 'salon_ottoman'],
  })
})
test('a Slop lies on the seat he sat on, a lobed mound of slime stuck there until it is picked up', () => {
  for (const candidate of sights) {
    const slop = new Slop(candidate, slopRandom(1, candidate.id))
    expect(slop.id).toBe(`slop-${candidate.id}`)
    expect(slop.propId).toBe(`prop-slop-${candidate.id}`)
    expect(slop.title).toBe('Slop')
    expect(slop.room).toBe(candidate.room)
    expect(slop.type).toBe('fixed')
    expect(slop.position).toEqual([candidate.position[0], candidate.position[1] + candidate.seat.height, candidate.position[2]])
  }
  const slop = new Slop(armchair, slopRandom(1, armchair.id))
  const model = slop.createModel()
  try {
    expect(model.parts.map(({name}) => name)).toEqual(['slop-slime'])
    // Its slime is the green the seed rolled for the slop at this sight, the one in front of his face there.
    const [{material}] = model.parts
    expect(material).toBeInstanceOf(SlopMaterial)
    const face = new SlopMaterial(slopRandom(1, armchair.id))
    expect((material as SlopMaterial).hueShift).toBe(face.hueShift)
    expect((material as SlopMaterial).color.getHex()).toBe(face.color.getHex())
    face.dispose()
    const [{geometry}] = model.parts
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    // It lies on the seat, wider than high, and fits between the arms of the armchair.
    expect(box.min.y).toBeCloseTo(0, 6)
    expect(box.max.y).toBeGreaterThan(0.1)
    expect(box.max.y).toBeLessThan(0.13)
    expect(box.max.x - box.min.x).toBeGreaterThan(0.3)
    expect(box.max.x - box.min.x).toBeLessThan(seatWidth + armchairSpread)
    expect(box.max.z - box.min.z).toBeLessThan(depth / 2)
    // Its faces look outward, so its rim on the seat lies outside of its top.
    const normal = geometry.getAttribute('normal')
    const position = geometry.getAttribute('position')
    let outward = 0
    for (let index = 0; index < position.count; index++) {
      outward += Math.sign(normal.getX(index) * position.getX(index) + normal.getZ(index) * position.getZ(index) + normal.getY(index) * 0.02)
    }
    expect(outward).toBeGreaterThan(position.count * 0.9)
    // Its body is a rounded cylinder as wide as its foot and as high as its mound, standing on what it stands on.
    expect(slop.colliders).toHaveLength(1)
    const [body] = slop.colliders
    expect(body).toMatchObject({
      mass: slop.mass,
      rotation: [0, 0, 0],
      shape: 'roundCylinder',
    })
    const [halfHeight, radius, border] = body.args as [number, number, number]
    expect(body.position[1] - halfHeight - border).toBeCloseTo(0, 9)
    expect(body.position[1] + halfHeight + border).toBeCloseTo(box.max.y, 2)
    expect(radius + border).toBeGreaterThan((box.max.x - box.min.x) / 2 - 0.04)
  } finally {
    model.dispose()
  }
})
