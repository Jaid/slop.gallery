import {expect, test} from 'bun:test'

import {AmbientLight, DirectionalLight, Group, PointLight, SpotLight, Vector3, Vector4} from 'three/webgpu'

import foilKeyLight from '../../src/canvas_materials/lib/foilKeyLight.ts'

test('a foil follows the strongest lamp reaching its print in world space and picks up live edits', () => {
  const rig = new Group
  rig.position.x = 10
  const sun = new DirectionalLight(0xFF_FF_FF, 1)
  sun.position.set(0, 4, 0)
  const bulb = new PointLight(0xFF_FF_FF, 12, 5, 2)
  bulb.position.z = 2
  const spot = new SpotLight(0xFF_FF_FF, 24, 5, Math.PI / 4, 0.4, 2)
  spot.position.set(2, 0, 0)
  rig.add(sun, sun.target, bulb, spot, spot.target)
  rig.updateMatrixWorld(true)
  const center = new Vector3(10, 0, 0)
  const lights = [sun, bulb, spot, new AmbientLight(0xFF_FF_FF, 100)]
  const read = () => foilKeyLight(lights, center, new Vector4).toArray()
  expect(read()).toEqual([12, 0, 0, 1])
  spot.target.position.set(2, 0, 5)
  rig.updateMatrixWorld(true)
  expect(read()).toEqual([10, 0, 2, 1])
  bulb.distance = 1
  expect(read()).toEqual([0, 1, 0, 0])
  sun.intensity = 0
  expect(read()).toEqual([0, 0, 0, 0])
})
