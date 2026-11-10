import type {BufferGeometry} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Box3, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import fountain, {crownHeight, jetFlightTime, jetLanding, sheetFlightTime, sheetLanding, sheetPoint} from '../../src/fountains/limestone/config.ts'
import LimestoneFountainGeometry from '../../src/fountains/limestone/LimestoneFountainGeometry.ts'
import LimestoneFountainMist, {fountainMist} from '../../src/fountains/limestone/LimestoneFountainMist.ts'
import LimestoneFountainSpray, {fountainDroplets} from '../../src/fountains/limestone/LimestoneFountainSpray.ts'
import LimestoneFountainStoneMaterial from '../../src/fountains/limestone/LimestoneFountainStoneMaterial.ts'
import LimestoneFountainWaterMaterial from '../../src/fountains/limestone/LimestoneFountainWaterMaterial.ts'
import WaterEnvironment from '../../src/fountains/limestone/WaterEnvironment.ts'
import WaterStreamGeometry from '../../src/fountains/limestone/WaterStreamGeometry.ts'
import WaterVeilGeometry from '../../src/fountains/limestone/WaterVeilGeometry.ts'
import {colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import {fountainBench, fountainBenches} from '../../src/lib/gallery/fountainBenches.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import TransparentSpriteOutputsNode from '../../src/lib/rendering/TransparentSpriteOutputsNode.ts'

await RAPIER.init()
const down = new Vector3(0, -1, 0)
/** Every face’s winding agrees with its shading normals, so single-sided materials and shadows see the outside. */
function frontFacesMatchNormals(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.index!
  const [a, b, c, face, shading, n] = Array.from({length: 6}, () => new Vector3)
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1)).sub(a)
    c.fromBufferAttribute(position, index.getX(i + 2)).sub(a)
    face.crossVectors(b, c)
    shading.set(0, 0, 0)
    for (let j = 0; j < 3; j++) {
      shading.add(n.fromBufferAttribute(normal, index.getX(i + j)))
    }
    if (face.dot(shading) <= 0) {
      return false
    }
  }
  return true
}
describe('water geometry', () => {
  test('a stream is a closed tube of the requested thickness that follows its ballistic path', () => {
    const jet = fountain.ringJet
    const duration = jetFlightTime(jet)
    const mouth = 0.02
    const geometry = new WaterStreamGeometry({
      radius: age => jet.radius + jet.outward * age,
      y: age => jet.y + jet.rise * age - fountain.gravity / 2 * age ** 2,
      thickness: () => mouth,
    }, {
      duration,
      samples: 12,
      sides: 8,
    })
    try {
      const position = geometry.getAttribute('position')
      const rows = 8
      const columns = 12
      expect(position.count).toBe((columns + 1) * rows)
      for (let i = 0; i < position.count; i++) {
        const radius = Math.hypot(position.getX(i), position.getZ(i))
        const age = duration * Math.floor(i / rows) / columns
        // The tube is drawn in the z = 0 plane: every ring hugs its centerline within the mouth’s radius.
        expect(Math.abs(radius - (jet.radius + jet.outward * age))).toBeLessThan(mouth * 2 + 0.01)
      }
      expect(geometry.boundingBox!.max.y).toBeCloseTo(jet.y + jet.rise ** 2 / (2 * fountain.gravity) + mouth, 2)
      expect(frontFacesMatchNormals(geometry)).toBe(true)
    } finally {
      geometry.dispose()
    }
  })
  test('a veil sweeps tongues out of its lip and ends in a ragged hem', () => {
    const sheet = fountain.veils.lower
    const duration = sheetFlightTime(sheet)
    const geometry = new WaterVeilGeometry({
      radius: age => sheetPoint(sheet, age)[0],
      y: age => sheetPoint(sheet, age)[1],
    }, {
      duration,
      lobeDepth: 0.05,
      lobes: 12,
      samples: 10,
      sides: 96,
    })
    try {
      expect(frontFacesMatchNormals(geometry)).toBe(true)
      const position = geometry.getAttribute('position')
      const rib = geometry.getAttribute('waterRib')
      const hem = geometry.getAttribute('waterHem')
      expect(rib.count).toBe(position.count)
      expect(hem.count).toBe(position.count)
      // The lip is a plain circle, the hem swings in and out with the tongues.
      const row = 11
      const lips: Array<number> = []
      const hems: Array<number> = []
      for (let side = 0; side < 96; side++) {
        lips.push(Math.hypot(position.getX(side * row), position.getZ(side * row)))
        const at = side * row + 10
        hems.push(Math.hypot(position.getX(at), position.getZ(at)))
      }
      expect(Math.max(...lips) - Math.min(...lips)).toBeLessThan(0.003)
      expect(Math.max(...hems) - Math.min(...hems)).toBeGreaterThan(0.02)
      // Water gathers on the tongues, not in the folds between them.
      expect(Math.max(...rib.array)).toBeCloseTo(1, 5)
      expect(Math.min(...rib.array)).toBeCloseTo(0, 5)
      expect(Math.max(...hem.array)).toBeCloseTo(1, 5)
    } finally {
      geometry.dispose()
    }
  })
})
describe('limestone fountain', () => {
  test('the ornate fountain stays lean, finite, below the chandelier and clear of the benches', () => {
    const geometry = new LimestoneFountainGeometry
    try {
      const parts = [geometry.stone, geometry.gilt, geometry.pools, geometry.water]
      const bounds = new Box3
      for (const part of parts) {
        part.computeBoundingBox()
        bounds.union(part.boundingBox!)
        expect(part.index).not.toBeNull()
        for (const attribute of Object.values(part.attributes)) {
          expect([...attribute.array].every(Number.isFinite)).toBe(true)
        }
      }
      // The whole fountain: three bowls, their veils, eight ring jets and the tall jet.
      expect(parts.reduce((sum, part) => sum + triangleCount(part), 0)).toBeLessThan(18_000)
      expect(triangleCount(geometry.stone)).toBeLessThan(7000)
      expect(triangleCount(geometry.water)).toBeLessThan(8500)
      // The crown of the jet reaches over five meters, the cup’s rim just over four.
      expect(bounds.max.y).toBeGreaterThan(4.8)
      expect(bounds.max.y).toBeLessThan(5.6)
      expect(bounds.min.y).toBeCloseTo(0, 5)
      // Flat sides face the benches along x and z.
      expect(bounds.max.x).toBeCloseTo(fountain.footApothem, 5)
      expect(bounds.min.z).toBeCloseTo(-fountain.footApothem, 5)
      expect(lobbyFountainSpot[2] - fountain.radius).toBeGreaterThan(lobby.opening.center[1] + lobby.opening.size[1] / 2 + 1)
      // The stepped foot still leaves a walkway between the fountain and the benches.
      expect(fountainBench.radius - fountainBench.depth / 2 - fountain.radius).toBeGreaterThan(1.3)
      expect(fountainBenches).toHaveLength(4)
    } finally {
      geometry.dispose()
    }
  })
  test('stone and gilt are closed toward the outside, so shadows and single-sided shading stay correct', () => {
    const geometry = new LimestoneFountainGeometry
    try {
      expect(frontFacesMatchNormals(geometry.stone)).toBe(true)
      expect(frontFacesMatchNormals(geometry.gilt)).toBe(true)
    } finally {
      geometry.dispose()
    }
  })
  test('every bowl brims over its lip, and every veil lands in the pool below without touching the stone', () => {
    const {basinInnerApothem, basinPoolRadius, bowls, pools, veils} = fountain
    const geometry = new LimestoneFountainGeometry
    const material = new MeshBasicMaterial
    try {
      const stone = new Mesh(geometry.stone, material)
      const stoneAt = (radius: number) => {
        const probe = new Raycaster(new Vector3(radius, 6, 0.013), down)
        return probe.intersectObject(stone)[0]?.point.y ?? Number.NaN
      }
      for (const [bowl, sheet, pool, receiving] of [
        [bowls.lower, veils.lower, pools.lower, basinPoolRadius],
        [bowls.middle, veils.middle, pools.middle, veils.lower.radius],
        [bowls.cup, veils.cup, pools.cup, veils.middle.radius],
      ] as const) {
        // The water surface stands a few millimeters over the lip’s crest.
        expect(pool - bowl.rim).toBeGreaterThan(0.004)
        expect(pool - bowl.rim).toBeLessThan(0.02)
        // The sheet starts at the outer corner of the lip, a few millimeters under its crest.
        expect(sheet.y).toBeCloseTo(bowl.rim - 0.004, 6)
        expect(sheetFlightTime(sheet)).toBeGreaterThan(0)
        // The sheet leaves at the lip and falls into the pool below.
        expect(sheet.radius).toBeLessThanOrEqual(bowl.lip)
        expect(sheetLanding(sheet)).toBeLessThan(receiving - 0.1)
        // It never swings back into the stone it pours from, tongues and all.
        for (let i = 1; i <= 20; i++) {
          const [radius, y] = sheetPoint(sheet, sheetFlightTime(sheet) * i / 20)
          expect(radius).toBeGreaterThan(bowl.lip - 0.05)
          expect(y).toBeLessThanOrEqual(pool)
          expect(Number.isNaN(stoneAt(radius)) || stoneAt(radius) < y + 0.001).toBe(true)
        }
      }
      // The basin surface tucks into the inner wall instead of floating away from it.
      expect(basinPoolRadius).toBeGreaterThan(basinInnerApothem - 0.01)
      expect(basinPoolRadius).toBeLessThan(basinInnerApothem + 0.02)
    } finally {
      material.dispose()
      geometry.dispose()
    }
  })
  test('the ring jets rise inside the basin wall and break into droplets that fall back into it', () => {
    const {basinInnerApothem, bowls, pools, ringJet} = fountain
    const apex = ringJet.y + ringJet.rise ** 2 / (2 * fountain.gravity)
    expect(apex).toBeGreaterThan(pools.basin + 1)
    expect(apex).toBeGreaterThan(fountain.rimTop)
    // They break well inside the basin’s wall, never over the benches.
    expect(jetLanding(ringJet)).toBeLessThan(basinInnerApothem - 0.05)
    expect(ringJet.radius).toBeGreaterThan(bowls.lower.lip)
    // Every drop comes back down inside the fountain’s own water.
    for (const {origin, velocity, until} of fountainDroplets()) {
      const lifetime = (velocity[1] + Math.sqrt(velocity[1] ** 2 + 2 * fountain.gravity * (origin[1] - until))) / fountain.gravity
      const landing = Math.hypot(origin[0] + velocity[0] * lifetime, origin[2] + velocity[2] * lifetime)
      expect(landing).toBeLessThan(fountain.basinPoolRadius)
    }
    // The column is drawn up to its apex; the droplets take over above it.
    expect(crownHeight).toBeGreaterThan(apex)
  })
  test('the basin is hollow and uses the same carved mesh for physics and visible surfaces', () => {
    const geometry = new LimestoneFountainGeometry
    const material = new MeshBasicMaterial
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    try {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry.stone), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
      world.step()
      const mesh = new Mesh(geometry.stone, material)
      // Points from the pedestal, the basin floor, both inner walls and the stepped foot. Rays that graze a drip bead a few millimeters deep are left out: there the visual and the physical surface may enter the groove on different sides.
      for (const x of [0, 0.3, 0.6, 1, 1.1, 1.4, 1.6, 1.9, 2.05]) {
        const origin = new Vector3(x, 6, 0.013)
        const probe = new Raycaster(origin, down)
        const visual = probe.intersectObject(mesh).at(0)
        const physical = world.castRay(new RAPIER.Ray(origin, down), 7, true)
        expect(!!physical).toBe(!!visual)
        if (visual && physical) {
          expect(6 - physical.timeOfImpact).toBeCloseTo(visual.point.y, 4)
        }
      }
      const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1.2, 1, 0))
      world.createCollider(RAPIER.ColliderDesc.ball(0.1), ball)
      for (let i = 0; i < 300; i++) {
        world.step()
      }
      expect(ball.translation().y).toBeCloseTo(fountain.basinFloor + 0.1, 2)
      expect(ball.translation().y).toBeLessThan(fountain.poolY)
      expect(ball.translation().x).toBeCloseTo(1.2, 2)
    } finally {
      world.free()
      material.dispose()
      geometry.dispose()
    }
  })
  test('water and stone are real animated node graphs, and fast mode only dims the reflection', () => {
    const environment = new WaterEnvironment
    try {
      for (const falling of [false, true]) {
        for (const heavy of [false, true]) {
          const material = new LimestoneFountainWaterMaterial(falling, heavy, {environment})
          expect(material.isMeshPhysicalNodeMaterial).toBe(true)
          expect(material.transparent).toBe(true)
          expect(material.depthWrite).toBe(false)
          // The pools do not spend a screen-space transmission pass on the stone below.
          expect(material.transmission).toBe(0)
          expect(material.envMap).toBe(environment)
          expect(material.envMapIntensity).toBe(heavy ? 1.3 : 0.65)
          expect(material.roughnessNode).not.toBeNull()
          expect(material.opacityNode).not.toBeNull()
          if (falling) {
            // Sheets and jets shift their own vertices and are lit by their shape and aeration, not by a bump normal.
            expect(material.colorNode).not.toBeNull()
            expect(material.normalNode).toBeNull()
          } else {
            expect(material.normalNode).not.toBeNull()
            expect(material.positionNode).not.toBeNull()
          }
          material.dispose()
        }
      }
      // A bright, contrasty sky: the sun’s disc is far brighter than the sky around it.
      const pixels = environment.image.data as Float32Array
      let brightest = 0
      let total = 0
      for (let i = 0; i < pixels.length; i += 4) {
        brightest = Math.max(brightest, pixels[i], pixels[i + 1], pixels[i + 2])
        total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
      }
      expect(pixels.every(Number.isFinite)).toBe(true)
      expect(brightest).toBeGreaterThan(20)
      expect(total / (pixels.length / 4)).toBeGreaterThan(0.4)
      expect(total / (pixels.length / 4)).toBeLessThan(3)
    } finally {
      environment.dispose()
    }
    const stone = new LimestoneFountainStoneMaterial
    expect(stone.colorNode).not.toBeNull()
    expect(stone.roughnessNode).not.toBeNull()
    stone.dispose()
    const geometry = new LimestoneFountainGeometry
    try {
      for (const name of ['waterFall', 'waterAir', 'waterDense', 'waterRib', 'waterHem']) {
        const attribute = geometry.water.getAttribute(name)
        expect(attribute.count).toBe(geometry.water.getAttribute('position').count)
        expect([...attribute.array].every(value => value >= 0 && value <= 1)).toBe(true)
      }
      for (const name of ['splashA', 'splashB', 'foamA', 'foamB']) {
        const attribute = geometry.pools.getAttribute(name)
        expect(attribute.count).toBe(geometry.pools.getAttribute('position').count)
        expect([...attribute.array].every(Number.isFinite)).toBe(true)
      }
    } finally {
      geometry.dispose()
    }
  })
  test('spray and mist are finite, animated and stay inside the fountain', () => {
    const spray = new LimestoneFountainSpray
    expect(spray.count).toBe(fountain.sprayCount)
    expect(spray.frustumCulled).toBe(false)
    expect(spray.material.positionNode).not.toBeNull()
    expect(spray.material.mrtNode).toBeInstanceOf(TransparentSpriteOutputsNode)
    for (const name of ['sprayOrigin', 'sprayVelocity', 'sprayMotion']) {
      const attribute = spray.geometry.getAttribute(name)
      expect(attribute.count).toBe(fountain.sprayCount)
      expect([...attribute.array].every(Number.isFinite)).toBe(true)
    }
    const motion = spray.geometry.getAttribute('sprayMotion')
    for (let i = 0; i < motion.count; i++) {
      // Every drop lives for a while and has a size.
      expect(motion.getY(i)).toBeGreaterThan(0)
      expect(motion.getZ(i)).toBeGreaterThan(0)
    }
    // A WebGPU pipeline takes eight vertex buffers at most: everything the geometry holds and the instance matrix.
    expect(Object.keys(spray.geometry.attributes).length + 1).toBeLessThanOrEqual(8)
    spray.dispose()
    const mist = new LimestoneFountainMist
    expect(mist.count).toBe(fountain.mistCount)
    expect(mist.frustumCulled).toBe(false)
    expect(mist.material.positionNode).not.toBeNull()
    expect(mist.material.mrtNode).toBeInstanceOf(TransparentSpriteOutputsNode)
    for (const name of ['mistOrigin', 'mistMotion', 'mistOpacity']) {
      const attribute = mist.geometry.getAttribute(name)
      expect(attribute.count).toBe(fountain.mistCount)
      expect([...attribute.array].every(Number.isFinite)).toBe(true)
    }
    expect(Object.keys(mist.geometry.attributes).length + 1).toBeLessThanOrEqual(8)
    mist.dispose()
    const puffs = fountainMist()
    expect(puffs).toHaveLength(fountain.mistCount)
    for (const puff of puffs) {
      expect(Math.hypot(puff.origin[0], puff.origin[2])).toBeLessThan(fountain.basinPoolRadius)
      expect(puff.origin[1]).toBeGreaterThan(fountain.poolY)
      expect(puff.lifetime).toBeGreaterThan(1)
      expect(puff.opacity).toBeLessThan(0.2)
    }
  })
})
