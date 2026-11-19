import type {PendantBody, PendantMount} from '../../src/lib/gallery/pendants/index.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import {DoubleSide, ExtrudeGeometry, Mesh, MeshBasicMaterial, Raycaster, Shape, Vector2, Vector3} from 'three/webgpu'

import {bastionApproach, bastionCurve, bastionGateLantern, bastionMouth, bastionTransition} from '../../src/lib/gallery/bastion.ts'
import {corridorHallLanterns, corridorLanding, corridorLandingLantern, corridorPassage, corridorStairs} from '../../src/lib/gallery/corridor.ts'
import {lodgeWindowRibCutouts} from '../../src/lib/gallery/lodge.ts'
import LodgeWindowGeometry from '../../src/lib/gallery/LodgeWindowGeometry.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import TimberGeometry from '../../src/lib/gallery/passages/TimberGeometry.ts'
import TransitionGeometry from '../../src/lib/gallery/passages/TransitionGeometry.ts'
import VaultGeometry from '../../src/lib/gallery/passages/VaultGeometry.ts'
import {CeilingProbe, LanternBody, PendantGeometry} from '../../src/lib/gallery/pendants/index.ts'
import {passageLightDrop, passagePendantMounts, routePendantMounts} from '../../src/lib/gallery/pendants/mounts.ts'
import {canopyEmbed, canopyHeight, canopyRadius} from '../../src/lib/gallery/pendants/PendantGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'

const mouth = new VaultGeometry(bastionMouth)
const curve = new RouteVaultGeometry(bastionCurve)
const approach = new VaultGeometry(bastionApproach, bastionTransition.length)
const corridor = TimberGeometry.passage(corridorPassage, lodgeWindowRibCutouts)
const landing = TimberGeometry.passage(corridorLanding)
const stairs = TimberGeometry.stairs(corridorStairs, true)
const transition = new TransitionGeometry(bastionTransition)
const lodgeWindow = new LodgeWindowGeometry
const material = new MeshBasicMaterial({side: DoubleSide})
// The flat roof slabs over passage elbows, as rendered by CoveredPassage.
const slabs = [
  ...[bastionMouth, bastionApproach].flatMap(passage => passage.floors.map(floor => {
    const slab = new ExtrudeGeometry(new Shape(floor.map(([x, z]) => new Vector2(x, -z))), {
      depth: 0.24,
      bevelEnabled: false,
    })
    return slab.rotateX(-Math.PI / 2).translate(0, passage.floorY + passage.height, 0)
  })),
  ...[corridorPassage, corridorLanding].flatMap(passage => passage.junctions.map(floor => {
    const slab = new ExtrudeGeometry(new Shape(floor.map(([x, z]) => new Vector2(x, -z))), {
      depth: 0.24,
      bevelEnabled: false,
    })
    return slab.rotateX(-Math.PI / 2).translate(0, passage.floorY + passage.height, 0)
  })),
]
const meshes = [mouth.shell, mouth.ribs, curve.shell, curve.ribs, approach.shell, approach.ribs, corridor.shell, corridor.ribs, landing.shell, landing.ribs, stairs.shell, stairs.ribs, transition.timber, transition.lining, lodgeWindow.frame, lodgeWindow.lining, ...slabs].map(geometry => {
  const mesh = new Mesh(geometry, material)
  mesh.updateMatrixWorld()
  return mesh
})
const lantern = new LanternBody
const gate = bastionCurve.route.at(bastionGateLantern)
const groups: Array<{
  body: PendantBody
  label: string
  /** how high each light hangs */
  lights: Array<number>
  mounts: Array<PendantMount>
}> = [
  {
    label: 'castle curve',
    body: lantern,
    lights: [gate.y + gate.height - passageLightDrop],
    mounts: routePendantMounts(bastionCurve, [curve.shell, curve.ribs], [bastionGateLantern]),
  },
  // The approach to the Lodge is all timber transition, with no room for a lantern.
  (() => {
    const mounts = passagePendantMounts(bastionMouth, [mouth.shell, mouth.ribs])
    return {
      label: 'castle mouth',
      body: lantern,
      lights: mounts.map(() => bastionMouth.floorY + bastionMouth.height - passageLightDrop),
      mounts,
    }
  })(),
  {
    label: 'timber corridor',
    body: lantern,
    lights: Array.from({length: 3}, () => corridorPassage.floorY + corridorPassage.height - passageLightDrop),
    mounts: corridorHallLanterns,
  },
  {
    label: 'timber corridor landing',
    body: lantern,
    lights: [corridorLanding.floorY + corridorLanding.height - passageLightDrop],
    mounts: [corridorLandingLantern],
  },
]
afterAll(() => {
  for (const geometry of [mouth, curve, approach, corridor, landing, stairs, transition, lodgeWindow, ...slabs]) {
    geometry.dispose()
  }
  material.dispose()
})
const firstHit = (origin: Vector3, direction: Vector3, far = Infinity) => {
  const raycaster = new Raycaster(origin, direction.clone().normalize(), 0, far)
  return raycaster.intersectObjects(meshes)[0]
}
describe('ceiling-hung pendants', () => {
  test('every light hangs its drop under its passage’s crown', () => {
    expect(groups[0].mounts).toHaveLength(1)
    expect(groups[2].mounts).toHaveLength(3)
    expect(groups[3].mounts).toHaveLength(1)
    for (const {mounts, lights} of groups) {
      expect(mounts).toHaveLength(lights.length)
      for (const [i, mount] of mounts.entries()) {
        expect(mount.light[1]).toBeCloseTo(lights[i])
      }
    }
  })
  for (const {label, body, mounts} of groups) {
    test(`${label}: the rod reaches the first ceiling straight above each light`, () => {
      for (const mount of mounts) {
        const hook = new Vector3(...mount.light)
        hook.y += body.hook
        const hit = firstHit(hook, new Vector3(0, 1, 0))
        expect(hit).toBeDefined()
        expect(hit.point.y).toBeCloseTo(mount.anchor[1], 4)
        expect(mount.drop).toBeCloseTo(mount.anchor[1] - mount.light[1], 6)
        // Room for a visible rod between the fixture and its canopy.
        expect(mount.drop - body.hook).toBeGreaterThan(canopyHeight + 0.03)
      }
    })
    test(`${label}: canopies sit flush on the ceiling, without gaps or overhanging rib edges`, () => {
      for (const mount of mounts) {
        const down = new Vector3(...mount.normal)
        const tangent = new Vector3(0, 0, 1)
        tangent.cross(down).normalize()
        if (tangent.lengthSq() < 0.5) {
          tangent.set(1, 0, 0)
        }
        const bitangent = down.clone().cross(tangent).normalize()
        // The canopy’s top face, sunk into the ceiling.
        const top = new Vector3(...mount.anchor)
        top.addScaledVector(down, -canopyEmbed)
        const radius = mount.canopyRadius ?? canopyRadius
        for (let i = 0; i < 24; i++) {
          const angle = i / 24 * Math.PI * 2
          const rim = top.clone().addScaledVector(tangent, Math.cos(angle) * radius).addScaledVector(bitangent, Math.sin(angle) * radius)
          const below = rim.clone().addScaledVector(down, canopyHeight)
          const hit = firstHit(below, down.clone().negate(), 1)
          // The ceiling crosses the canopy’s side wall: neither floating below nor buried above it.
          expect(hit).toBeDefined()
          expect(hit.distance).toBeGreaterThan(0)
          expect(hit.distance).toBeLessThan(canopyHeight)
        }
      }
    })
    test(`${label}: fixtures stay clear of walls, ribs and portals`, () => {
      for (const mount of mounts) {
        const light = new Vector3(...mount.light)
        for (const height of [body.bottom + 0.01, 0, body.hook - 0.01]) {
          for (let i = 0; i < 16; i++) {
            const angle = i / 16 * Math.PI * 2
            const origin = light.clone().setY(light.y + height)
            expect(firstHit(origin, new Vector3(Math.cos(angle), 0, Math.sin(angle)), body.radius + 0.05)).toBeUndefined()
          }
        }
        expect(firstHit(light.clone().setY(light.y + body.bottom + 0.01), new Vector3(0, -1, 0), 1.5)).toBeUndefined()
      }
    })
    test(`${label}: geometry is finite, compact and reaches its canopy`, () => {
      for (const mount of mounts) {
        const geometry = new PendantGeometry(body, mount)
        try {
          for (const part of [geometry.frame, geometry.glow]) {
            for (const attribute of Object.values(part.attributes)) {
              expect([...attribute.array].every(Number.isFinite)).toBe(true)
            }
          }
          expect(triangleCount(geometry.frame) + triangleCount(geometry.glow)).toBeLessThan(700)
          geometry.frame.computeBoundingBox()
          geometry.glow.computeBoundingBox()
          const bounds = geometry.frame.boundingBox!.clone().union(geometry.glow.boundingBox!)
          expect(bounds.max.y).toBeGreaterThan(mount.drop - canopyEmbed - 0.002)
          expect(bounds.max.y).toBeLessThan(mount.drop + 0.04)
          expect(bounds.min.y).toBeCloseTo(body.bottom, 3)
        } finally {
          geometry.dispose()
        }
      }
    })
  }
  test('a probe without a ceiling above refuses to mount, and slides only horizontally', () => {
    const probe = new CeilingProbe([approach.shell])
    expect(probe.mount([1000, 0, 1000], [1, 0, 0])).toBeUndefined()
    expect(() => probe.mount([0, 0, 0], [0, 1, 0])).toThrow(RangeError)
    expect(() => probe.mount([0, 0, 0], [0, 0, 0])).toThrow(RangeError)
    expect(() => new PendantGeometry(lantern, {
      drop: 0.1,
      normal: [0, -1, 0],
    })).toThrow(RangeError)
    expect(() => new PendantGeometry(lantern, {
      drop: 1,
      normal: [0, 1, 0],
    })).toThrow(RangeError)
  })
})
