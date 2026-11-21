import type {SloperatorPlacement} from '../../src/lib/gallery/sloperator/placement.ts'
import type {SloperatorSeatedSight} from '../../src/lib/gallery/sloperator/sights.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, expect, test} from 'bun:test'

import {Box3, Euler, Quaternion, Vector3} from 'three/webgpu'

import {apseOpeningPoint, apseOpenings} from '../../src/lib/gallery/bastion.ts'
import {lodgeSpur} from '../../src/lib/gallery/bastionNetwork.ts'
import corridor from '../../src/lib/gallery/corridor.ts'
import Slop from '../../src/lib/gallery/curios/slop/Slop.ts'
import {fountainBench} from '../../src/lib/gallery/fountainBenches.ts'
import {probeGeofences, startGeofences, useGeofences} from '../../src/lib/gallery/geofences.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import lodge, {lodgeEastWindow, lodgeWindow} from '../../src/lib/gallery/lodge.ts'
import lodgeInterior from '../../src/lib/gallery/lodgeInterior/layout.ts'
import UpholsteredSeatGeometry from '../../src/lib/gallery/lodgeInterior/UpholsteredSeatGeometry.ts'
import lowerGallery, {oculusPlatform, tunnelFloorHeight} from '../../src/lib/gallery/lowerGallery.ts'
import oculusApse from '../../src/lib/gallery/oculusApse.ts'
import oculusTower, {towerRamp} from '../../src/lib/gallery/oculusTower.ts'
import {salonBench} from '../../src/lib/gallery/salon.ts'
import {figureBounds, floorRise} from '../../src/lib/gallery/sloperator/placement.ts'
import {sightSloperator, spawnAtSight, useSloperator} from '../../src/lib/gallery/sloperator/sightings.ts'
import sights, {slopRandom} from '../../src/lib/gallery/sloperator/sights.ts'
import SloperatorGeometry from '../../src/lib/gallery/sloperator/SloperatorGeometry.ts'
import SloperatorMotion from '../../src/lib/gallery/sloperator/SloperatorMotion.ts'
import SloperatorRig from '../../src/lib/gallery/sloperator/SloperatorRig.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import tunnelDisplays from '../../src/lib/gallery/tunnelDisplays.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import SlopMaterial from '../../src/lib/materials/SlopMaterial.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const {armchairSpread, seatWidth} = lodgeInterior
const {armHeight, armRollRadius, armWidth, backHeight, depth, seatHeight} = UpholsteredSeatGeometry
const sight = (id: typeof sights[number]['id']) => sights.find(candidate => candidate.id === id)!
/** The sight, which has a seat. */
const seated = (id: typeof sights[number]['id']) => {
  const found = sight(id)
  if (!found.furniture) {
    throw new Error(`${id} has no seat`)
  }
  return found
}
const armchair = seated('lodge_east_armchair')
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
  for (const part of [figure.cane, figure.cloth, figure.skin, figure.slime]) {
    box.union(part.boundingBox!)
  }
  return box
}
const sighting = (id: typeof sights[number]['id']) => ({
  sight: id,
  distance: 5,
  pose: 'sit' as const,
  position: [1, 2, 3] satisfies Vec3,
})
/** How he sits at the sight while his seat stands where it stood, as the physics would place him there. */
const seatedAt = ({position, seat, yaw}: SloperatorSeatedSight): SloperatorPlacement => ({
  fixed: Boolean(seat.arms),
  pose: seat.arms ? 'sit_armchair' : 'sit',
  position,
  surface: seat.height,
  yaw,
})
/** Places him at the sight with a seat like the physics does on the player entering its fence. */
const place = (id: typeof sights[number]['id']) => spawnAtSight(id, {
  detection: 'present',
  placement: seatedAt(seated(id)),
  result: 'success',
})
afterEach(() => {
  useGeofences.setState(useGeofences.getInitialState(), true)
  useSloperator.setState(useSloperator.getInitialState(), true)
  useGallery.setState({
    room: slopGallery.defaultRoom,
    whereabouts: [slopGallery.defaultRoom],
  })
})
test('the Sloperator sits a meter tall in the armchair, between its arms, his feet on the floor in front of it', () => {
  const figure = new SloperatorGeometry(armchair.seat)
  const seat = new UpholsteredSeatGeometry(1, seatWidth + armchairSpread)
  try {
    for (const part of [figure.cane, figure.cloth, figure.skin, figure.slime]) {
      expect(Object.keys(part.attributes).toSorted()).toEqual(['normal', 'position', 'uv'])
    }
    const box = boxOf(figure)
    // From the seat cushion under him to the crown of his hat, which stands over everything else of him: a meter upright, a few millimeters less leaning back into the armchair
    expect(SloperatorGeometry.height).toBe(1)
    expect(box.max.y).toBeLessThan(seatHeight + SloperatorGeometry.height)
    expect(box.max.y).toBeGreaterThan(seatHeight + SloperatorGeometry.height - 0.01)
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
    // His right fist holds his cane by its handle, its shaft pointing to his left across in front of him over the arms, past his left hand.
    const cane = figure.cane.boundingBox!
    const hands = figure.skin.boundingBox!
    expect(cane.min.x).toBeGreaterThan(hands.min.x)
    expect(cane.min.x).toBeLessThan(hands.min.x + 0.06)
    // It rests on his left forearm, which lies along the roll a little in from its middle.
    expect(cane.max.x).toBeGreaterThan(armchair.seat.arms!.x - 0.085)
    expect(cane.max.x).toBeLessThan(armchair.seat.arms!.x)
    // Over the rolls where his forearms lie on them, never in them
    expect(cane.min.y).toBeGreaterThan(armHeight + Math.sqrt(armRollRadius ** 2 - 0.085 ** 2))
    expect(cane.max.y).toBeLessThan(cane.min.y + 0.15)
    expect(cane.min.z).toBeGreaterThan(0.15)
    // A figure only ever seen from afar
    expect(triangleCount(figure.cane) + triangleCount(figure.cloth) + triangleCount(figure.skin) + triangleCount(figure.slime)).toBeLessThan(12_000)
  } finally {
    figure.dispose()
    seat.dispose()
  }
})
test('on a seat without arms, he sits upright and as tall, his knees apart round his cane standing between his feet and his hands stacked on its handle', () => {
  for (const {seat} of [seated('lobby_east_bench'), seated('lobby_north_bench'), seated('salon_ottoman')]) {
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
      // His cane stands on the floor between his shoes and reaches up between his knees to his chest, leaning back toward him.
      const cane = figure.cane.boundingBox!
      expect(cane.min.y).toBeCloseTo(0, 3)
      expect(cane.max.y).toBeGreaterThan(seat.height + 0.4)
      expect(cane.max.x).toBeLessThan(0.02)
      expect(cane.max.z).toBeGreaterThan(SloperatorGeometry.lap)
      // His hands lie on its handle, one on the other, in front of him, his elbows out to his sides.
      const hands = figure.skin.boundingBox!
      expect(hands.max.x).toBeLessThan(0.11)
      expect(hands.min.y).toBeGreaterThan(cane.max.y - 0.03)
      expect(hands.max.z).toBeGreaterThan(cane.min.z)
      expect(box.max.x).toBeLessThan(0.38)
    } finally {
      figure.dispose()
      leaning.dispose()
    }
  }
})
test('without a seat, he stands upright where he would sit, a head taller than seated, his shoes flat on the floor and his hands stacked on his cane in front of him', () => {
  const standing = new SloperatorGeometry
  const sitting = new SloperatorGeometry(seated('lobby_east_bench').seat)
  try {
    const box = boxOf(standing)
    expect(box.min.y).toBeCloseTo(0, 6)
    // A tall gentleman of 1.8 m with his bowler on, from the floor to the crown of his hat
    expect(box.max.y).toBeGreaterThan(1.85)
    expect(box.max.y).toBeLessThan(1.95)
    // Narrow and shallow: his shoulders and his hands across, his back to the toes of his shoes along, all round where he would sit
    expect(box.max.x - box.min.x).toBeLessThan(0.75)
    expect(box.max.z - box.min.z).toBeLessThan(0.5)
    expect(box.min.z).toBeLessThan(0)
    expect(box.max.z).toBeGreaterThan(0.2)
    // His cane stands on the floor between the toes of his shoes, and his hands lie on its handle in front of his hips, the right on the left.
    const cane = standing.cane.boundingBox!
    expect(cane.min.y).toBeCloseTo(0, 3)
    expect(cane.max.y).toBeGreaterThan(0.85)
    expect(cane.max.y).toBeLessThan(1)
    expect(cane.max.z).toBeLessThan(box.max.z + 1e-6)
    const skin = standing.skin.boundingBox!
    expect(skin.min.y).toBeGreaterThan(cane.max.y - 0.03)
    expect(skin.min.y).toBeLessThan(1)
    expect(skin.max.x).toBeLessThan(0.11)
    // The box round him standing, his hands on his cane or behind his back, is what the physics checks for room to stand in.
    expect(figureBounds().containsBox(box)).toBe(true)
  } finally {
    standing.dispose()
    sitting.dispose()
  }
})
test('his rig keeps him the same man in every pose: the same parts, his head level and as large however he sits or stands', () => {
  const poses = [new SloperatorGeometry, new SloperatorGeometry(armchair.seat), new SloperatorGeometry(seated('lobby_east_bench').seat)]
  try {
    const [standing, ...others] = poses
    const sizeOf = (geometry: SloperatorGeometry) => {
      const size = new Vector3
      return geometry.slime.boundingBox!.getSize(size)
    }
    for (const other of others) {
      for (const part of ['cane', 'cloth', 'skin', 'slime'] as const) {
        expect(triangleCount(other[part])).toBe(triangleCount(standing[part]))
      }
      // The slop in front of his face only turns with his head, which stays level, so its box keeps its size.
      expect(sizeOf(other).distanceTo(sizeOf(standing))).toBeLessThan(1e-6)
    }
  } finally {
    for (const pose of poses) {
      pose.dispose()
    }
  }
})
test('his rig poses him the same again from where his limbs reach in a pose, which is what his moves blend between', () => {
  const rig = new SloperatorRig
  try {
    for (const pose of [() => rig.stand(), () => rig.sit(armchair.seat), () => rig.sit(seated('lobby_east_bench').seat)]) {
      pose()
      rig.root.updateMatrixWorld(true)
      const before = rig.parts.map(({bone}) => bone.matrixWorld.clone())
      rig.follow(rig.goals())
      rig.root.updateMatrixWorld(true)
      for (const [index, {bone}] of rig.parts.entries()) {
        const [moved, turned] = [new Vector3, new Quaternion]
        const [was, wasTurned] = [new Vector3, new Quaternion]
        bone.matrixWorld.decompose(moved, turned, new Vector3)
        before[index].decompose(was, wasTurned, new Vector3)
        // A few millimeters at most, where a knee sits a hair off the reach of his shin
        expect(moved.distanceTo(was)).toBeLessThan(0.003)
        expect(turned.angleTo(wasTurned)).toBeLessThan(0.01)
      }
    }
  } finally {
    rig.dispose()
  }
})
/** Every corner of the geometries, in his frame, as he is posed now. */
const cornersOf = (...geometries: Array<SloperatorGeometry['cloth']>) => geometries.flatMap(geometry => {
  const position = geometry.getAttribute('position')
  return Array.from({length: position.count}, (_ignored, index) => {
    const corner = new Vector3
    return corner.fromBufferAttribute(position, index)
  })
})
test('once sighted, he gets up off his seat and stands in front of its edge, his hands back on his cane, never sinking into the seat or the floor on his way', () => {
  for (const {seat} of [armchair, seated('lobby_east_bench'), seated('salon_ottoman')]) {
    const figure = new SloperatorGeometry(seat)
    const standing = new SloperatorGeometry
    try {
      const neutral = boxOf(figure)
      expect(figure.duration).toBeGreaterThan(0)
      /** how far the lowest of him over the seat, behind its front edge, sinks into it: as far as leaning back into an armchair presses the back of his coat into its back cushion at most */
      const sunk = () => Math.max(0, ...cornersOf(figure.cloth, figure.cane).filter(corner => corner.z < SloperatorGeometry.lap - 0.1 && Math.abs(corner.x) < 0.3).map(corner => seat.height - corner.y))
      const leaning = sunk()
      expect(leaning).toBeLessThan(0.015)
      for (let step = 1; step <= 40; step++) {
        figure.pose(step / 40)
        // His shoes and his cane stay on the floor or over it, and nothing of him sinks into the seat behind its front edge further than he sat.
        expect(boxOf(figure).min.y).toBeGreaterThan(-1e-6)
        expect(sunk()).toBeLessThanOrEqual(Math.max(leaning, 0.002))
      }
      // Up, he stands as tall as standing anyway, the backs of his legs in front of the seat’s edge, his cane on the floor in front of his toes and his hands on its handle.
      const up = boxOf(figure)
      expect(up.max.y).toBeCloseTo(boxOf(standing).max.y, 6)
      expect(up.min.y).toBeCloseTo(0, 6)
      for (const corner of cornersOf(figure.cloth)) {
        if (corner.y < 0.85) {
          expect(corner.z).toBeGreaterThan(SloperatorGeometry.lap + 0.02)
        }
      }
      const cane = figure.cane.boundingBox!
      expect(cane.min.y).toBeCloseTo(0, 3)
      expect(figure.skin.boundingBox!.min.y).toBeGreaterThan(cane.max.y - 0.03)
      // Back to the start, he sits as he did.
      figure.pose(0)
      expect(boxOf(figure).equals(neutral)).toBe(true)
    } finally {
      figure.dispose()
      standing.dispose()
    }
  }
})
test('once sighted standing, he spins his cane up in his right fist and brings his hands low behind his back, his arms hanging all but straight, his cane pointing up behind him, his head as it was', () => {
  const figure = new SloperatorGeometry
  const rig = new SloperatorRig
  try {
    const neutral = boxOf(figure)
    const slop = figure.slime.boundingBox!.clone()
    expect(figure.duration).toBeGreaterThan(0)
    for (let step = 1; step <= 40; step++) {
      figure.pose(step / 40)
      expect(boxOf(figure).min.y).toBeGreaterThan(-1e-6)
    }
    const box = boxOf(figure)
    expect(box.max.y).toBeCloseTo(neutral.max.y, 6)
    expect(figure.slime.boundingBox!.equals(slop)).toBe(true)
    // His hands meet behind him, under the hem of his coat, his left over his right, his elbows hanging close under his shoulders, not hiked up like a strained grip’s.
    const motion = new SloperatorMotion(rig)
    motion.pose(1)
    const {elbows, grip, hands, pelvis, tip} = rig.goals()
    for (const side of [-1, 1] as const) {
      expect(hands[side].y).toBeLessThan(pelvis.y)
      expect(hands[side].z).toBeLessThan(pelvis.z - 0.15)
      expect(Math.abs(hands[side].x)).toBeLessThan(0.05)
      expect(elbows[side].y).toBeGreaterThan(pelvis.y + 0.2)
      expect(Math.abs(elbows[side].x)).toBeLessThan(0.3)
    }
    expect(hands[1].z).toBeLessThan(hands[-1].z)
    for (const corner of cornersOf(figure.skin)) {
      if (!(corner.y < 1.3)) {
        continue
      }
      expect(corner.z).toBeLessThan(-0.1)
      expect(Math.abs(corner.x)).toBeLessThan(0.12)
    }
    // His cane points up from under his right fist, its handle under it, rising behind his back toward his left shoulder and under the crown of his hat.
    expect(grip.y).toBeLessThan(hands[-1].y)
    expect(tip.y - grip.y).toBeGreaterThan(0.8)
    expect(tip.x).toBeGreaterThan(0.1)
    expect(tip.z).toBeLessThan(-0.25)
    const cane = figure.cane.boundingBox!
    expect(cane.max.z).toBeLessThan(-0.05)
    expect(cane.max.y).toBeLessThan(box.max.y - 0.1)
    expect(cane.min.y).toBeGreaterThan(0.7)
    // Nothing of him reaches into the box round him standing with his hands behind his back that the physics did not check.
    expect(figureBounds().containsBox(box)).toBe(true)
  } finally {
    figure.dispose()
    rig.dispose()
  }
})
test('a seat’s cushions lie where whoever sits on them finds them', () => {
  const seat = new UpholsteredSeatGeometry(1)
  try {
    expect(seat.leather.boundingBox!.max.y).toBeCloseTo(backHeight, 6)
    expect(seat.leather.boundingBox!.max.x).toBeCloseTo(seat.width / 2 + UpholsteredSeatGeometry.armRollOffset + armRollRadius - armWidth / 2, 6)
  } finally {
    seat.dispose()
  }
})
test('every sight is a seat or a spot in a room of the gallery, seen from a fence of the gallery that does not hold it', () => {
  expect(sights.map(({id}) => id)).toEqual(['lodge_east_armchair', 'lodge_west_armchair', 'lobby_east_bench', 'lobby_north_bench', 'salon_ottoman', 'exhibition_glass'])
  const fences = slopGallery.dumpGeofences().map(({id}) => id)
  for (const {fence, furniture, position: [x, y, z], room, seat} of sights) {
    expect(fences).toContain(fence)
    // Where he sits or stands, his middle is in his room and out of the fence he is seen from, so nobody ever stands where he is while he is.
    const around = slopGallery.geofences.getMatches([x, y + (seat ? seat.height + 0.5 : 0.9), z])
    expect(around).toContain(room)
    expect(around).not.toContain(fence)
    expect(slopGallery.roomById(room)).toBeDefined()
    // A seat and the furniture it is come together.
    expect(Boolean(furniture)).toBe(Boolean(seat))
  }
  expect(sights.map(({fence}) => fence)).toEqual(['bastion-knight_alley', 'corridor-window', 'salon', 'oculus', 'forge', 'bastion-gate'])
  // Each piece of furniture is the seat of one sight at most, and only the Exhibition’s floor slopes under him.
  const bodies = sights.flatMap(({furniture}) => furniture?.body ?? [])
  expect(bodies).toEqual([...new Set(bodies)])
  expect(sights.filter(({slope}) => slope).map(({id}) => id)).toEqual(['exhibition_glass'])
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
  expect(slopGallery.geofences.getMatches([eye[0], eye[1] - 0.7, eye[2]])).toContain('bastion-knight_alley')
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
test('his other armchair stands in front of the Lodge’s west window, its back to it, where the Corridor’s long hall sees his hat over the deep sill of the window’s niche', () => {
  const west = seated('lodge_west_armchair')
  const [x, floorY, z] = west.position
  expect(floorY).toBe(lodge.floorY)
  expect(west.indoors).toBe(true)
  expect(west.seat).toEqual(armchair.seat)
  expect(west.furniture.body).toBe('lodge-armchair-1')
  // The east armchair mirrored across the Lodge’s middle: in front of the window in the west wall, inside the room, facing away from it
  expect(x - lodge.center[0]).toBeCloseTo(lodge.center[0] - armchair.position[0], 6)
  expect(z).toBe(armchair.position[2])
  expect(west.yaw).toBe(-armchair.yaw)
  expect(Math.abs(z - lodgeWindow.z)).toBeLessThan(lodgeWindow.width / 2)
  expect(x).toBeGreaterThan(lodgeWindow.roomX + 1)
  expect(Math.sin(west.yaw)).toBeGreaterThan(0.7)
  // From anywhere along the hall abreast of the window, a player looks through its glass, over the far end of its niche’s sill, at the crown of his hat and the middle of his head.
  for (const eyeZ of [lodgeWindow.z - lodgeWindow.width / 2, lodgeWindow.z, lodgeWindow.z + lodgeWindow.width / 2]) {
    const eye = [corridor.center[0], lodge.floorY + 1.6, eyeZ] as const
    expect(slopGallery.geofences.getMatches([eye[0], eye[1] - 0.7, eye[2]])).toEqual(['corridor', 'corridor-window'])
    for (const height of [seatHeight + SloperatorGeometry.height - 0.02, seatHeight + SloperatorGeometry.height - 0.22]) {
      const target = [x, lodge.floorY + height, z] as const
      for (const planeX of [lodgeWindow.tunnelX, lodgeWindow.roomX]) {
        const share = (planeX - eye[0]) / (target[0] - eye[0])
        const crossY = eye[1] + (target[1] - eye[1]) * share
        const crossZ = eye[2] + (target[2] - eye[2]) * share
        expect(share).toBeGreaterThan(0)
        expect(share).toBeLessThan(1)
        expect(crossY).toBeGreaterThan(lodgeWindow.bottom)
        expect(crossY).toBeLessThan(lodgeWindow.top)
        expect(Math.abs(crossZ - lodgeWindow.z)).toBeLessThan(lodgeWindow.width / 2)
      }
    }
  }
})
test('on the Lobby’s east bench he faces the fountain from its south end, on its north bench from its middle, and on the Salon’s ottoman the sculpture, his thighs reaching to their front edges', () => {
  const bench = seated('lobby_east_bench')
  const north = seated('lobby_north_bench')
  const ottoman = seated('salon_ottoman')
  // The bench east of the fountain, which he faces west to, south of its middle
  expect(bench.position[0]).toBeCloseTo(4 + SloperatorGeometry.lap - fountainBench.depth / 2, 6)
  expect(bench.position[1]).toBe(0)
  expect(bench.position[2]).toBeGreaterThan(lobbyFountainSpot[2])
  expect(bench.position[2]).toBeLessThan(lobbyFountainSpot[2] + fountainBench.width / 2)
  expect(Math.sin(bench.yaw)).toBeCloseTo(-1, 6)
  expect(bench.seat.height).toBe(fountainBench.height)
  // Where his knees are, the bench’s front edge lies under them.
  expect(bench.position[0] - SloperatorGeometry.lap).toBeCloseTo(4 - fountainBench.depth / 2, 6)
  // The bench north of the fountain, which he faces south to, in its middle
  expect(north.furniture.body).toBe('lobby-bench-north')
  expect(north.position[0]).toBeCloseTo(0, 6)
  expect(north.position[1]).toBe(0)
  expect(north.position[2] + SloperatorGeometry.lap).toBeCloseTo(-16 + fountainBench.depth / 2, 6)
  expect(Math.cos(north.yaw)).toBeCloseTo(1, 6)
  expect(north.seat.height).toBe(fountainBench.height)
  // The ottoman on the Salon’s axis, which he faces north on
  expect(ottoman.position[0]).toBe(salonBench.position[0])
  expect(ottoman.position[2] - SloperatorGeometry.lap).toBeCloseTo(salonBench.position[2] - salonBench.depth / 2, 6)
  expect(Math.cos(ottoman.yaw)).toBeCloseTo(-1, 6)
  expect(Math.abs(Math.sin(ottoman.yaw))).toBeLessThan(1e-9)
  expect(ottoman.seat.height).toBe(salonBench.seatHeight)
})
test('the Oculus sees his back on the Lobby’s north bench from the back of its platform and from its apse, up through the glazed floor, though from its floor not at all and from the platform’s front edge at most the crown of his hat', () => {
  const {position: [x, , z]} = seated('lobby_north_bench')
  const [, openingZ] = lobby.opening.center
  const openingSouthZ = openingZ + lobby.opening.size[1] / 2
  const openingNorthZ = openingZ - lobby.opening.size[1] / 2
  const platformY = oculusPlatform.position[1] + oculusPlatform.size[1] / 2
  /** where the line from the eye to his head crosses the Lobby’s floor */
  const throughFloor = (eye: Vec3, height: number) => eye[2] + (z - eye[2]) * (0 - eye[1]) / (height - eye[1])
  /** the crown of his hat and the middle of his head */
  const [crown, head] = [fountainBench.height + SloperatorGeometry.height - 0.02, fountainBench.height + SloperatorGeometry.height - 0.22]
  for (const height of [crown, head]) {
    // From where the apse begins, at the back of the platform, back into the apse
    for (const eyeZ of [oculusApse.northZ, oculusApse.northZ - oculusApse.depth + 1]) {
      const eye: Vec3 = [x, platformY + 1.6, eyeZ]
      expect(slopGallery.geofences.getMatches(eye)).toContain('oculus')
      const crossZ = throughFloor(eye, height)
      expect(crossZ).toBeGreaterThan(openingNorthZ)
      expect(crossZ).toBeLessThan(openingSouthZ - 0.15)
    }
  }
  // From the platform’s front edge and the floor in front of it, the Lobby’s floor south of the glass hides his head.
  const platformFront = oculusPlatform.position[2] + oculusPlatform.size[2] / 2
  expect(throughFloor([x, platformY + 1.6, platformFront - 0.3], head)).toBeGreaterThan(openingSouthZ)
  expect(throughFloor([x, lowerGallery.oculus.floorY + 1.6, platformFront + 0.5], crown)).toBeGreaterThan(openingSouthZ)
})
test('in the Exhibition he stands on its sloping floor, looking through the east display’s glass at its first exhibit, where the Bastion behind the Oculus’ gate sees his back through the apse’s west window', () => {
  const glass = sight('exhibition_glass')
  expect(glass.furniture).toBeUndefined()
  expect(glass.seat).toBeUndefined()
  expect(glass.indoors).toBeUndefined()
  const [x, y, z] = glass.position
  expect(y).toBe(tunnelFloorHeight(x, z)!)
  expect(slopGallery.roomAt([x, y + 0.9, z])?.id).toBe('exhibition')
  const [exhibitX, , exhibitZ] = tunnelDisplays.find(({side}) => side === 'east')!.exhibits[0].position
  expect(Math.sin(glass.yaw)).toBeCloseTo((exhibitX - x) / Math.hypot(exhibitX - x, exhibitZ - z), 6)
  expect(Math.cos(glass.yaw)).toBeCloseTo((exhibitZ - z) / Math.hypot(exhibitX - x, exhibitZ - z), 6)
  // The floor under him rises toward Moonfall, never higher under his feet than the box he would stand in starts over it.
  const rise = floorRise(glass.yaw, glass.slope)
  expect(rise).toBeGreaterThan(0.03)
  expect(rise).toBeLessThan(0.1)
  const {min, max} = figureBounds()
  let highest = -Infinity
  for (let along = min.x; along <= max.x + 1e-9; along += (max.x - min.x) / 10) {
    for (let across = min.z; across <= max.z + 1e-9; across += (max.z - min.z) / 10) {
      const pointX = x + along * Math.cos(glass.yaw) + across * Math.sin(glass.yaw)
      const pointZ = z - along * Math.sin(glass.yaw) + across * Math.cos(glass.yaw)
      highest = Math.max(highest, tunnelFloorHeight(pointX, pointZ)! - y)
    }
  }
  expect(highest).toBeGreaterThan(rise - 0.005)
  expect(highest).toBeLessThan(rise + 1e-6)
  // From behind the west window, in the Bastion’s curve behind the gate, a player looks at his head and shoulders, the crown of his hat down to his chest.
  const window = apseOpenings.find(({name}) => name === 'west_window')!
  const platformY = oculusPlatform.position[1] + oculusPlatform.size[1] / 2
  const [eyeX, eyeZ] = apseOpeningPoint(window, 1.2)
  const eye: Vec3 = [eyeX, platformY + 1.6, eyeZ]
  expect(slopGallery.geofences.getMatches([eye[0], eye[1] - 0.7, eye[2]])).toEqual(['bastion', 'bastion-gate'])
  const {tunnel} = lowerGallery
  for (const height of [figureBounds().max.y - 0.02, 1.5, 1.2]) {
    const target: Vec3 = [x, y + height, z]
    const at = (share: number) => eye.map((value, axis) => value + (target[axis] - value) * share) as Vec3
    const shareAtZ = (planeZ: number) => (planeZ - eye[2]) / (target[2] - eye[2])
    // Through the window, between its jambs and over its sill, where it pierces the apse’s wall
    const {center, radius} = oculusApse.arcs[window.arc]
    let share = 0
    while (Math.hypot(at(share)[0] - center[0], at(share)[2] - center[1]) > radius) {
      share += 1e-4
    }
    const [wallX, wallY, wallZ] = at(share)
    const off = Math.atan2(wallZ - center[1], wallX - center[0]) - window.angle
    expect(Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) * radius).toBeLessThan(window.width / 2)
    expect(wallY - platformY).toBeGreaterThan(window.bottom)
    expect(wallY - platformY).toBeLessThan(window.height)
    // Over the edge of the platform
    expect(at(shareAtZ(oculusPlatform.position[2] + oculusPlatform.size[2] / 2))[1]).toBeGreaterThan(platformY)
    // Past the tower and the foot of the ramp up to its deck, which reaches as wide as the tower
    for (let along = 0; along <= 1; along += 1e-3) {
      const [pointX, , pointZ] = at(along)
      expect(Math.hypot(pointX - oculusTower.x, pointZ - oculusTower.z)).toBeGreaterThan(oculusTower.radius + 0.25)
      if (pointZ > towerRamp.startZ && pointZ < towerRamp.endZ) {
        expect(Math.abs(pointX - oculusTower.x)).toBeGreaterThan(towerRamp.width / 2 + towerRamp.baseCornerRadius)
      }
    }
    // Into the tunnel between its jambs and under its top, where it leaves the Oculus’ south wall
    const [mouthX, mouthY] = at(shareAtZ(tunnel.northZ))
    expect(Math.abs(mouthX - tunnel.northX)).toBeLessThan(tunnel.width / 2 - 0.2)
    expect(mouthY).toBeLessThan(tunnel.northY + tunnel.height)
  }
})
test('aiming at him changes nothing until the player leaves the sight’s fence, where he then leaves a Slop where he was and never returns', () => {
  startGeofences(places.link)
  probeGeofences(places.alley, still)
  expect(useGeofences.getState().fences).toContain('bastion-knight_alley')
  place('lodge_east_armchair')
  // Leaving without having caught sight of him leaves no Slop, and forgets where he was placed.
  probeGeofences(places.link, still)
  expect(useSloperator.getState().spawns).toEqual({})
  probeGeofences(places.alley, still)
  expect(useSloperator.getState().sighted).toEqual([])
  expect(useSloperator.getState().slopped).toEqual({})
  place('lodge_east_armchair')
  const first = sighting('lodge_east_armchair')
  expect(sightSloperator(first)).toBe(true)
  // Only the first sight of him at a sight counts.
  expect(sightSloperator({
    ...first,
    distance: 2,
  })).toBe(false)
  probeGeofences([-16.93, -4.1, -34], still)
  expect(useSloperator.getState().sighted).toEqual([first])
  expect(useSloperator.getState().slopped).toEqual({})
  probeGeofences(places.link, still)
  expect(useSloperator.getState().sighted).toEqual([])
  expect(useSloperator.getState().slopped).toEqual({lodge_east_armchair: seatedAt(armchair)})
  // Back in the alley, there is nothing left to catch sight of.
  probeGeofences(places.alley, still)
  expect(sightSloperator(first)).toBe(false)
  probeGeofences(places.link, still)
  expect(useSloperator.getState().slopped).toEqual({lodge_east_armchair: seatedAt(armchair)})
})
test('each sight goes by its own fence, a room’s too, and a start elsewhere leaves a sight caught waiting', () => {
  startGeofences(places.salon)
  place('lobby_east_bench')
  expect(sightSloperator(sighting('lobby_east_bench'))).toBe(true)
  startGeofences(places.forge)
  place('salon_ottoman')
  expect(sightSloperator(sighting('salon_ottoman'))).toBe(true)
  // A player who starts anew elsewhere has left no fence, though where he was placed is forgotten: entering the fence places him anew.
  startGeofences(places.lobby)
  expect(useSloperator.getState().slopped).toEqual({})
  expect(useSloperator.getState().spawns).toEqual({})
  expect(useSloperator.getState().sighted.map(({sight: id}) => id)).toEqual(['lobby_east_bench', 'salon_ottoman'])
  // Into the Salon and out through the arch into the Banquet: only the bench’s sight goes by the Salon’s fence.
  probeGeofences(places.salon, still)
  place('lobby_east_bench')
  expect(useSloperator.getState().slopped).toEqual({})
  probeGeofences(places.banquet, still)
  expect(useGeofences.getState().fences).not.toContain('salon')
  expect(useSloperator.getState().sighted).toEqual([sighting('salon_ottoman')])
  expect(Object.keys(useSloperator.getState().slopped)).toEqual(['lobby_east_bench'])
  probeGeofences(places.forge, still)
  place('salon_ottoman')
  probeGeofences(places.lobby, still)
  expect(useSloperator.getState().sighted).toEqual([])
  expect(useSloperator.getState().slopped).toEqual({
    lobby_east_bench: seatedAt(seated('lobby_east_bench')),
    salon_ottoman: seatedAt(seated('salon_ottoman')),
  })
})
test('a Slop lies on top of what he was on, where he was: stuck to a seat that never moves, loose on one the physics moves and on the floor', () => {
  for (const candidate of sights) {
    if (candidate.furniture) {
      const slop = new Slop(candidate, seatedAt(candidate), slopRandom(1, candidate.id))
      expect(slop.id).toBe(`slop-${candidate.id}`)
      expect(slop.propId).toBe(`prop-slop-${candidate.id}`)
      expect(slop.title).toBe('Slop')
      expect(slop.room).toBe(candidate.room)
      expect(slop.type).toBe(candidate.id.startsWith('lodge_') ? 'fixed' : 'dynamic')
      expect(slop.position).toEqual([candidate.position[0], candidate.position[1] + candidate.seat.height, candidate.position[2]])
      expect(slop.rotation).toEqual([0, candidate.yaw, 0])
    }
    const standing = new Slop(candidate, {
      fixed: false,
      pose: 'stand',
      position: [1, 2, 3],
      surface: 0,
      yaw: 0.5,
    }, slopRandom(1, candidate.id))
    expect(standing.position).toEqual([1, 2, 3])
    expect(standing.type).toBe('dynamic')
    if (!candidate.slope) {
      expect(standing.rotation).toEqual([0, 0.5, 0])
      continue
    }
    // On the Exhibition’s sloping floor, its foot lies flat on it, facing the way he faced.
    const {grade, yaw} = candidate.slope
    const turn = new Quaternion
    turn.setFromEuler(new Euler(...standing.rotation))
    const upright = new Vector3(0, 1, 0)
    upright.applyQuaternion(turn)
    const normal = new Vector3(-grade * Math.sin(yaw), 1, -grade * Math.cos(yaw))
    expect(upright.distanceTo(normal.normalize())).toBeLessThan(1e-6)
    const forward = new Vector3(0, 0, 1)
    forward.applyQuaternion(turn)
    expect(Math.atan2(forward.x, forward.z)).toBeCloseTo(0.5, 1)
  }
  const slop = new Slop(armchair, seatedAt(armchair), slopRandom(1, armchair.id))
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
