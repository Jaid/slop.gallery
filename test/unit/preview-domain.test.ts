import {expect, spyOn, test} from 'bun:test'

import {attachPreviewDomain} from '../../scripts/previewDomain.ts'

const answer = (result: unknown) => Response.json({
  success: true,
  result,
})
test.each([
  ['canary', 'main', 'main.slop-gallery.pages.dev'],
  ['pr-42', undefined, 'pr-42.slop-gallery.pages.dev'],
] as const)('attaches %s to its Pages preview', async (alias, branch, target) => {
  const hostname = `${alias}.slop.gallery`
  using api = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected Cloudflare request'))
  api.mockResolvedValueOnce(answer([])).mockResolvedValueOnce(answer({})).mockResolvedValueOnce(answer({status: 'active'}))
  const token = Bun.env.CLOUDFLARE_API_TOKEN
  try {
    Bun.env.CLOUDFLARE_API_TOKEN = 'test'
    expect(await attachPreviewDomain(alias, {branch})).toBe(`https://${hostname}`)
  } finally {
    if (token === undefined) {
      delete Bun.env.CLOUDFLARE_API_TOKEN
    } else {
      Bun.env.CLOUDFLARE_API_TOKEN = token
    }
  }
  const [, write] = api.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(JSON.parse(write!.body as string)).toMatchObject({
    type: 'CNAME',
    name: hostname,
    content: target,
    proxied: true,
  })
  expect(api.mock.calls.at(-1)![0]).toEndWith(`/domains/${hostname}`)
})
