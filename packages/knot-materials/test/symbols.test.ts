import {expect, test} from 'bun:test'
import {fileURLToPath} from 'node:url'

import {knotCandidates} from '../src/main.ts'

test('every candidate’s icon is the SVG symbol in its own folder', async () => {
  for (const candidate of knotCandidates) {
    expect(candidate.data.icon).toEndWith(`/${candidate.data.id}/symbol.svg`)
    const symbol = Bun.file(fileURLToPath(candidate.data.icon))
    expect(await symbol.text()).toContain('<svg')
  }
})
