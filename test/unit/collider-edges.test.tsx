import type {RapierCollider, RapierRigidBody} from '@react-three/rapier'
import type {Group} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {BallCollider, CuboidCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import {createRef} from 'react'

import ColliderEdges from '../../src/components/ColliderOutlines/ColliderEdges.ts'
import {mountPhysics} from './helpers/inertPhysics.tsx'

test('the outlines select actual shapes by collider, visual child, group or portrait ID and follow the live physics', async () => {
  const root = createRef<Group>()
  const body = createRef<RapierRigidBody>()
  await using mounted = await mountPhysics(<group name='room' ref={root}>
    <RigidBody colliders={false} name='bench' position={[4, 0, 0]} rotation={[0, Math.PI / 2, 0]} type='fixed' ref={body}>
      <CuboidCollider args={[1, 2, 3]} name='top' />
      <BallCollider args={[0.5]} position={[0, -2, 0]} />
      <group name='painted-bench'><mesh name='trim' /></group>
    </RigidBody>
    <RigidBody colliders={false} type='fixed' userData={{portraitId: 'work-1'}}><CuboidCollider args={[1, 1, 0.1]} /></RigidBody>
    <RigidBody colliders={false} name='empty' type='fixed' />
  </group>)
  const {physics} = mounted
  const read = (selection: true | string) => {
    const lines = new ColliderEdges(physics, root.current!, selection)
    try {
      return new Float32Array(lines.read().flatMap(block => [...block]))
    } finally {
      lines.dispose()
    }
  }
  // A box has 12 segments, without any body axes, and the rotated box spans 6 m in world x.
  const box = read('bench/top')
  expect(box.length).toBe(12 * 6)
  const xs = box.filter((_, i) => i % 3 === 0)
  expect(Math.min(...xs)).toBeCloseTo(1)
  expect(Math.max(...xs)).toBeCloseTo(7)
  const bench = read('painted-bench/trim')
  expect(bench.length).toBeGreaterThan(box.length)
  expect(read('bench')).toEqual(bench)
  expect(read('work-*').length).toBe(box.length)
  expect(read('room')).toEqual(read(true))
  expect(read(true).length).toBe(bench.length + box.length)
  expect(read('empty').length).toBe(0)
  body.current!.setTranslation({
    x: 8,
    y: 0,
    z: 0,
  }, false)
  physics.step(1 / 60)
  expect(read('top')[0] - box[0]).toBeCloseTo(4)
  body.current!.setEnabled(false)
  expect(read('bench').length).toBe(0)
  expect(read(true)).toEqual(read('work-*'))
})
test('fixed triangle outlines follow teleports, shape replacements and disabling even before a physics step', async () => {
  const root = createRef<Group>()
  const body = createRef<RapierRigidBody>()
  const collider = createRef<RapierCollider>()
  const triangle = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const indices = new Uint32Array([0, 1, 2])
  await using mounted = await mountPhysics(<group ref={root}>
    <RigidBody colliders={false} type='fixed' ref={body}><TrimeshCollider args={[triangle, indices]} ref={collider} /></RigidBody>
    <BallCollider args={[0.5]} />
  </group>)
  const lines = new ColliderEdges(mounted.physics, root.current!, true)
  try {
    const [initial, ball] = lines.read()
    expect(initial.length).toBe(3 * 6)
    expect(ball.length).toBeGreaterThan(0)
    expect(lines.read()[0]).toBe(initial)
    body.current!.setTranslation({
      x: 4,
      y: 0,
      z: 0,
    }, false)
    const [moved] = lines.read()
    expect(moved[0] - initial[0]).toBe(4)
    collider.current!.setShape(new mounted.physics.rapier.TriMesh(triangle.map(n => 2 * n), indices))
    expect(Math.max(...lines.read()[0])).toBe(6)
    collider.current!.setEnabled(false)
    const [gone, remaining] = lines.read()
    expect(gone.length).toBe(0)
    expect(remaining).toEqual(ball)
  } finally {
    lines.dispose()
  }
})
