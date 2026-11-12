import {expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {candidateSignSuspensionCenter, candidateSignSuspensionHeight, knotCandidateSign} from 'knot-materials/knotCandidateSign.ts'
import KnotCandidateSignGeometry from 'knot-materials/KnotCandidateSignGeometry.ts'
import {knotPreviewHeight, knotPreviewMountY, knotPreviewPanelOffsetY} from 'knot-materials/KnotPreviewLayout.ts'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {Quaternion, Vector3} from 'three/webgpu'

import KnotCandidateSignFace, {candidateSignBackground, candidateSignTextureSize} from '#component/KnotCandidateSignFace'

import {knotGalleryBounds} from '../../src/lib/gallery/knotGallery.ts'
import {triangleCount} from '../../src/lib/geometry.ts'

await RAPIER.init()
function simulate(mass: number, miss = false, yaw = 0) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 120
  const rotation = new Quaternion
  rotation.setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  const elevation = knotGalleryBounds.height - knotCandidateSign.ceilingInset - knotCandidateSign.anchor[1]
  const pivot = new Vector3(0, elevation + knotCandidateSign.anchor[1], 0)
  const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pivot.x, pivot.y, pivot.z).setRotation(rotation))
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, elevation, 0).setRotation(rotation).setCcdEnabled(true).setCanSleep(false).setAngularDamping(knotCandidateSign.angularDamping).setLinearDamping(knotCandidateSign.linearDamping).setAdditionalSolverIterations(8))
  world.createCollider(RAPIER.ColliderDesc.cuboid(knotCandidateSign.size[0] / 2, knotCandidateSign.size[1] / 2, knotCandidateSign.size[2] / 2).setMass(knotCandidateSign.mass).setRestitution(0.15), body)
  for (const x of knotCandidateSign.suspensionX) {
    world.createCollider(RAPIER.ColliderDesc.cylinder(candidateSignSuspensionHeight / 2, 0.014).setTranslation(x, candidateSignSuspensionCenter, 0).setMass(knotCandidateSign.suspensionMass), body)
  }
  const joint = world.createImpulseJoint(RAPIER.JointData.revolute(new Vector3, new Vector3(...knotCandidateSign.anchor), new Vector3(...knotCandidateSign.axis)), anchor, body, true)
  expect(joint).toBeInstanceOf(RAPIER.RevoluteImpulseJoint)
  if (joint instanceof RAPIER.RevoluteImpulseJoint) {
    joint.setLimits(...knotCandidateSign.limits)
  }
  const displacement = () => Math.hypot(body.translation().x, body.translation().z)
  try {
    for (let i = 0; i < 360; i++) {
      world.step()
    }
    expect(displacement()).toBeLessThan(0.001)
    const origin = new Vector3(miss ? 3 : 0.6, elevation, 2)
    origin.applyQuaternion(rotation)
    const velocity = new Vector3(0, 0, -12)
    velocity.applyQuaternion(rotation)
    const projectile = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(origin.x, origin.y, origin.z).setLinvel(velocity.x, velocity.y, velocity.z).setGravityScale(0).setCcdEnabled(true))
    world.createCollider(RAPIER.ColliderDesc.ball(0.18).setMass(mass), projectile)
    let peak = 0
    let drift = 0
    for (let i = 0; i < 960; i++) {
      world.step()
      peak = Math.max(peak, displacement())
      const q = body.rotation()
      const position = body.translation()
      const pin = new Vector3(...knotCandidateSign.anchor)
      pin.applyQuaternion(new Quaternion(q.x, q.y, q.z, q.w)).add(new Vector3(position.x, position.y, position.z))
      drift = Math.max(drift, pin.distanceTo(pivot))
    }
    expect(drift).toBeLessThan(0.015)
    expect(peak).toBeLessThan(knotCandidateSign.anchor[1] * Math.sin(knotCandidateSign.limits[1]) + 0.03)
    world.removeRigidBody(projectile)
    for (let i = 0; i < 5400; i++) {
      world.step()
    }
    expect(displacement()).toBeLessThan(0.02)
    const settledVelocity = new Vector3(body.linvel().x, body.linvel().y, body.linvel().z)
    expect(settledVelocity.length()).toBeLessThan(0.002)
    return peak
  } finally {
    world.free()
  }
}
test('ceiling-mounted signs swing after real impacts and settle without detaching', () => {
  const light = simulate(1.8)
  const heavy = simulate(5)
  expect(light).toBeGreaterThan(0.1)
  expect(heavy).toBeGreaterThan(light * 1.1)
  expect(simulate(1.8, false, Math.PI / 2)).toBeCloseTo(light, 2)
  expect(simulate(5, true)).toBeLessThan(0.001)
})
test('large physical signs have two ceiling mounts, bounded chain geometry and room above the billboards', () => {
  const geometry = new KnotCandidateSignGeometry
  try {
    const bottom = knotGalleryBounds.height - knotCandidateSign.ceilingInset - knotCandidateSign.anchor[1] - knotCandidateSign.size[1] / 2
    expect(bottom).toBeGreaterThan(knotPreviewMountY + knotPreviewPanelOffsetY + knotPreviewHeight / 2 + 0.25)
    expect(knotCandidateSign.suspensionX).toHaveLength(2)
    expect(geometry.panel.groups).toHaveLength(6)
    expect(triangleCount(geometry.chains)).toBeLessThan(6000)
    expect(geometry.canopy.boundingBox!.max.y + knotGalleryBounds.height - knotCandidateSign.ceilingInset - knotCandidateSign.anchor[1]).toBeGreaterThan(knotGalleryBounds.height - 0.09)
    for (const part of [geometry.panel, geometry.chains, geometry.canopy]) {
      expect([...part.getAttribute('position').array].every(Number.isFinite)).toBe(true)
    }
    let disposed = 0
    for (const part of [geometry.panel, geometry.chains, geometry.canopy]) {
      part.addEventListener('dispose', () => disposed++)
    }
    geometry.dispose()
    expect(disposed).toBe(3)
  } finally {
    geometry.dispose()
  }
})
test('printed faces use a compact raster with a fitted model name and its mark, without exhibit numbers', () => {
  expect(candidateSignTextureSize).toEqual([1024, 246])
  expect(candidateSignTextureSize[0] * candidateSignTextureSize[1] * 4 * 12).toBeLessThan(12 * 1024 ** 2)
  for (const icon of ['/mark.svg', undefined]) {
    const markup = renderToStaticMarkup(createElement(KnotCandidateSignFace, {
      title: 'A very long model name',
      icon,
    }))
    expect(markup).toContain(`width:${candidateSignTextureSize[0]}px;height:${candidateSignTextureSize[1]}px`)
    expect(markup).toContain(`background:${candidateSignBackground}`)
    expect(markup.split('>A very long model name<')).toHaveLength(2)
    expect(markup.split('data-fit')).toHaveLength(2)
    expect(markup.includes('<img')).toBe(icon !== undefined)
    expect(markup).not.toContain('>#')
    if (icon) {
      expect(markup).toContain('src="/mark.svg"')
    }
  }
  // The name moves aside for the mark.
  const withMark = renderToStaticMarkup(createElement(KnotCandidateSignFace, {
    title: 'Name',
    icon: '/mark.svg',
  }))
  const alone = renderToStaticMarkup(createElement(KnotCandidateSignFace, {title: 'Name'}))
  expect(/class="([^"]*)" data-fit/u.exec(withMark)![1]).not.toBe(/class="([^"]*)" data-fit/u.exec(alone)![1])
})
