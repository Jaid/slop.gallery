import type {BodyContact} from 'rapier-body-contact'

import {expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import BodyContacts from 'rapier-body-contact'
import {Quaternion, Vector3} from 'three/webgpu'

import {frameContact, frameImpactSounds, frameImpactVoices} from '../../src/lib/audio/frameImpacts.ts'
import {orbImpactVoices} from '../../src/lib/audio/orbImpacts.ts'
import {frames} from '../../src/lib/frames/index.ts'

await RAPIER.init()
/** A world stepping like `<Physics>` of @react-three/rapier, with a floor 10 m square whose top lies at 0. */
function physics() {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 60
  Object.assign(world.integrationParameters, {
    normalizedAllowedLinearError: 0.001,
    normalizedPredictionDistance: 0.002,
  })
  world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setTranslation(0, -0.1, 0), world.createRigidBody(RAPIER.RigidBodyDesc.fixed()))
  const impacts: Array<BodyContact<string>> = []
  const sampler = new BodyContacts<string>({onContact: impact => impacts.push(impact)})
  const step = (count: number) => {
    for (let i = 0; i < count; i++) {
      sampler.capture()
      world.step()
      sampler.collect(world)
    }
  }
  return {
    world,
    impacts,
    sampler,
    step,
  }
}
test('a work dropped askew strikes with a corner first and lands flat at last, while the points it keeps touching stay quiet', () => {
  const {world, impacts, sampler, step} = physics()
  // Lying on its back, but tipped over two of its sides, so one corner hangs lowest
  const sideways = new Quaternion
  sideways.setFromAxisAngle(new Vector3(0, 0, 1), 0.3)
  const tipped = new Quaternion
  tipped.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2 + 0.3).premultiply(sideways)
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.6, 0).setRotation(tipped).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.35, 0.25, 0.03).setMass(2).setFriction(0.75).setRestitution(0.32), body)
  sampler.register(body, 'work')
  const contacts: Array<string> = []
  for (let i = 0; i < 240; i++) {
    const count = impacts.length
    step(1)
    if (impacts.length === count) {
      continue
    }
    const {normal, rotation} = impacts.at(-1)!
    const turn = new Quaternion
    const local = new Vector3
    local.copy(normal).applyQuaternion(turn.copy(rotation).invert())
    contacts.push(frameContact([local.x, local.y, local.z]))
  }
  expect(contacts[0]).toBe('corner')
  expect(contacts.at(-1)).toBe('flat')
  // It strikes a few times on its way down, not on every step it lies there.
  expect(contacts.length).toBeLessThan(8)
})
test('orbs sound louder and brighter the harder they strike, and like what they strike', () => {
  expect(orbImpactVoices('generic', 0.1)).toEqual([])
  const loudness = (speed: number) => orbImpactVoices('generic', speed).reduce((sum, voice) => sum + voice.volume, 0)
  expect(loudness(0.5)).toBeLessThan(loudness(3))
  expect(loudness(3)).toBeLessThan(loudness(10))
  const recipes = new Set((['generic', 'stone', 'hollow', 'fabric', 'glass', 'orb'] as const).map(surface => JSON.stringify(orbImpactVoices(surface, 4))))
  expect(recipes.size).toBe(6)
  // Flagstones are the hard ground with grit.
  expect(orbImpactVoices('stone', 4).slice(0, -1)).toEqual(orbImpactVoices('generic', 4))
  expect(orbImpactVoices('generic', 4, -1)).not.toEqual(orbImpactVoices('generic', 4, 1))
})
test('a work strikes with its face, a side or a corner, by the contact’s normal in its frame', () => {
  expect(frameContact([0, 0, 1])).toBe('flat')
  expect(frameContact([0.1, 0.1, -0.98])).toBe('flat')
  // A face tipped by 20° lands on its corner.
  expect(frameContact([0.24, 0.24, 0.94])).toBe('corner')
  expect(frameContact([0, -1, 0])).toBe('edge')
  expect(frameContact([0.98, 0.1, 0.2])).toBe('edge')
  expect(frameContact([0.7, -0.7, 0.1])).toBe('corner')
  for (const sound of Object.keys(frameImpactSounds) as Array<keyof typeof frameImpactSounds>) {
    const recipes = new Set((['corner', 'edge', 'flat'] as const).map(contact => JSON.stringify(frameImpactVoices(contact, 4, sound))))
    expect(recipes.size).toBe(3)
    expect(frameImpactVoices('edge', 0.1, sound)).toEqual([])
    const loudness = (speed: number) => frameImpactVoices('corner', speed, sound).reduce((sum, voice) => sum + voice.volume, 0)
    expect(loudness(1)).toBeLessThan(loudness(8))
  }
  expect(frameImpactVoices('edge', 4, 'hardwood')).not.toEqual(frameImpactVoices('edge', 4))
})
test('every frame sounds like one of the shared frame sounds, gilded wood unless it says otherwise', () => {
  expect(frames.classic.impactSound).toBe('gilt')
  expect(frames['bastion-oak'].impactSound).toBe('hardwood')
  expect(frames['bastion-strapwork'].impactSound).toBe('heavy')
  for (const frame of Object.values(frames)) {
    expect(Object.keys(frameImpactSounds)).toContain(frame.impactSound)
  }
})
