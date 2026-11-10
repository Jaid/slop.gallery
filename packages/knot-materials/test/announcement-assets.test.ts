import {expect, test} from 'bun:test'
import {resolve} from 'node:path'

import {announcementAssetsSource} from '../scripts/updateAnnouncements.ts'

test('knot announcement virtual imports match the current catalogue', async () => {
  const actual = await Bun.file(resolve(import.meta.dir, '../src/announcementAssets.ts')).text()
  expect(actual).toBe(announcementAssetsSource())
  expect(actual).toContain('/iris')
  expect(actual).toContain("emotion: 'loud'")
})
