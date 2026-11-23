import {expect, test} from 'bun:test'
import {dirname} from 'node:path'

import {EgoMotor} from 'ego-player'
import CoreMotor from 'ego-player/motor'
import fs from 'fs-extra'
import {PauseMenu} from 'use-pause-menu'
import CoreMenu from 'use-pause-menu/core'

test('the React and standalone entry points expose the same controller classes', () => {
  expect(EgoMotor).toBe(CoreMotor)
  expect(PauseMenu).toBe(CoreMenu)
})
test('React Rapier and direct physics imports resolve the same installation', async () => {
  const react = Bun.resolveSync('@react-three/rapier', import.meta.dir)
  const direct = Bun.resolveSync('@dimforge/rapier3d-compat', import.meta.dir)
  const nested = Bun.resolveSync('@dimforge/rapier3d-compat', dirname(react))
  expect(await fs.realpath(nested)).toBe(await fs.realpath(direct))
})
