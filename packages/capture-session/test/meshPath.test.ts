import {describe, expect, test} from 'bun:test'

import {Group, Mesh, Scene} from 'three/webgpu'

import {collectMeshPattern, matchesMeshPattern, meshPath, normalizeMeshPattern} from '../src/meshPath.ts'

const named = <T extends Group | Mesh>(object: T, name: string) => Object.assign(object, {name})
describe('mesh patterns', () => {
  const scene = new Scene
  const world = named(new Group, 'world')
  const machine = named(new Group, 'alchemy-machine')
  const bench = named(new Group, 'alchemy-workbench')
  const top = named(new Mesh, 'alchemy-workbench-top')
  const body = named(new Group, 'alchemy-machine')
  const pipe = named(new Mesh, 'alchemy-pipe')
  // like the turning barrel’s group, which has no name of its own
  const barrel = new Group
  const cannon = named(new Mesh, 'alchemy-cannon')
  const fountain = named(new Group, 'lobby-fountain')
  const water = named(new Mesh, 'fountain-falling-water')
  const otherWater = named(new Mesh, 'fountain-falling-water')
  bench.add(top)
  body.add(pipe)
  barrel.add(cannon)
  machine.add(bench, body, barrel)
  fountain.add(water)
  world.add(machine, fountain, otherWater)
  scene.add(world)
  test('a mesh path names the object and its named ancestors below the scene, like the X dump', () => {
    expect(meshPath(pipe)).toBe('world/alchemy-machine/alchemy-machine/alchemy-pipe')
    expect(meshPath(cannon)).toBe('world/alchemy-machine/alchemy-cannon')
    expect(meshPath(barrel)).toBe('world/alchemy-machine')
  })
  test('a pattern only has to match the end of the path', () => {
    expect(matchesMeshPattern(fountain, 'lobby-fountain')).toBe(true)
    expect(matchesMeshPattern(water, 'lobby-fountain/fountain-falling-water')).toBe(true)
    expect(matchesMeshPattern(otherWater, 'lobby-fountain/fountain-falling-water')).toBe(false)
    expect(matchesMeshPattern(otherWater, 'world/fountain-falling-water')).toBe(true)
    expect(matchesMeshPattern(water, 'world/fountain-falling-water')).toBe(false)
    expect(matchesMeshPattern(water, 'world/**/fountain-falling-water')).toBe(true)
    expect(matchesMeshPattern(pipe, 'alchemy-*')).toBe(true)
    expect(matchesMeshPattern(pipe, 'alchemy')).toBe(false)
  })
  test('unnamed objects have no path of their own to match', () => {
    expect(matchesMeshPattern(barrel, 'alchemy-machine')).toBe(false)
    expect(matchesMeshPattern(cannon, 'alchemy-machine/alchemy-cannon')).toBe(true)
  })
  test('the highlight takes every match and everything below it', () => {
    expect(collectMeshPattern(scene, 'lobby-fountain')).toEqual([fountain, water])
    expect(collectMeshPattern(scene, 'fountain-falling-water')).toEqual([water, otherWater])
    expect(collectMeshPattern(scene, 'alchemy-machine/{alchemy-machine,alchemy-cannon}')).toEqual([body, pipe, cannon])
    expect(collectMeshPattern(scene, 'alchemy-machine')).toEqual([machine, bench, top, body, pipe, barrel, cannon])
    expect(collectMeshPattern(scene, 'missing')).toEqual([])
  })
  test('a subtree knows the names above it', () => {
    expect(collectMeshPattern(machine, 'world/alchemy-machine/alchemy-cannon')).toEqual([cannon])
  })
  test('normalizing drops spaces around slashes and empty segments', () => {
    expect(normalizeMeshPattern(' alchemy-machine / {alchemy-machine,alchemy-cannon}/ ')).toBe('alchemy-machine/{alchemy-machine,alchemy-cannon}')
    expect(normalizeMeshPattern('//')).toBeUndefined()
    expect(normalizeMeshPattern(5)).toBeUndefined()
  })
})
