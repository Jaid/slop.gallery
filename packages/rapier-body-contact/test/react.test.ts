import type {World} from '@dimforge/rapier3d-compat'

import {expect, mock, test} from 'bun:test'

import BodyContacts from '../src/main.ts'

const before: Array<(world: World) => void> = []
const after: Array<(world: World) => void> = []
// The hook only wires the sampler to the two step hooks, which need a Physics around them.
await mock.module('@react-three/rapier', () => ({
  useBeforePhysicsStep: (callback: (world: World) => void) => before.push(callback),
  useAfterPhysicsStep: (callback: (world: World) => void) => after.push(callback),
}))
const {default: useBodyContacts} = await import('../src/react/main.ts')
test('the hook captures before every physics step and collects after it', () => {
  const calls: Array<unknown> = []
  const contacts = new BodyContacts({onContact() {}})
  contacts.capture = () => calls.push('capture')
  contacts.collect = world => calls.push(world)
  useBodyContacts(contacts)
  expect(before).toHaveLength(1)
  expect(after).toHaveLength(1)
  const world = {timestep: 1 / 60} as World
  before[0](world)
  after[0](world)
  expect(calls).toEqual(['capture', world])
})
