import type {CollisionEnterPayload} from '@react-three/rapier'

import {expect, test} from 'bun:test'

import {BallCollider, CuboidCollider, RigidBody} from '@react-three/rapier'

import {mountPhysics} from './helpers/inertPhysics.tsx'

test('a body that strikes another and bounces off within the steps of one frame still enters the collision, while it touches', async () => {
  const entered: Array<{
    other: unknown
    x: number
  }> = []
  const struck = ({other, target}: CollisionEnterPayload) => {
    entered.push({
      other: other.rigidBody?.userData,
      x: target.rigidBody!.translation().x,
    })
  }
  // a ball flying at a wall at 10 m/s, which it reaches 0.12 s later, and bouncing straight back off it
  await using mounted = await mountPhysics(<>
    <RigidBody colliders={false} type='fixed' userData={{id: 'wall'}}>
      <CuboidCollider args={[0.05, 1, 1]} position={[1, 0, 0]} restitution={1} />
    </RigidBody>
    <RigidBody colliders={false} linearVelocity={[10, 0, 0]} position={[-0.39, 0, 0]} type='dynamic' onCollisionEnter={struck}>
      <BallCollider args={[0.14]} restitution={1} />
    </RigidBody>
  </>, {gravity: [0, 0, 0]})
  // Frames of 0.1 s, as a slow or virtual clock hands them out, each 6 steps of 1/60 s: the ball reaches the wall in the first step of the second frame and is long gone from it again by its end.
  for (let frame = 0; frame < 3; frame++) {
    mounted.physics.step(0.1)
  }
  expect(entered).toHaveLength(1)
  expect(entered[0].other).toEqual({id: 'wall'})
  // told in the step it struck in, touching the wall’s face 0.95 m out, not where the frame left it, back where it started
  expect(entered[0].x).toBeGreaterThan(0.95 - 0.14 - 10 / 60)
})
