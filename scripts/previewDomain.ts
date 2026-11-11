import {parseArgs} from 'node:util'

type CloudflareResponse<Result> = {
  errors: Array<{
    code: number
    message: string
  }>
  result: Result
  result_info?: {
    page?: number
    total_pages?: number
  }
  success: boolean
}
type DnsRecord = {
  comment: string | null
  content: string
  id: string
  name: string
  proxied: boolean
  type: string
}
type PagesDomain = {
  created_on: string
  name: string
  status: 'active' | 'blocked' | 'deactivated' | 'error' | 'initializing' | 'pending'
  validation_data?: {error_message?: string}
  verification_data?: {error_message?: string}
}

const accountId = '94b07787e8a720b65196137d6224ec90'
const project = 'slop-gallery'
const zoneId = '984d19ff966225b2c4cf7a605e208b56'
const zoneName = 'slop.gallery'
// Marks the DNS records this script owns, so it never takes over or deletes one made by hand.
const recordComment = 'managed by the pages workflow'
const help = [
  'Usage: bun scripts/previewDomain.ts <attach|detach> <alias>',
  '',
  `Serves the Cloudflare Pages preview alias <alias>.${project}.pages.dev at <alias>.${zoneName} (attach) or stops doing so (detach).`,
  'attach waits until Cloudflare has validated the domain and issued its certificate.',
  `Needs CLOUDFLARE_API_TOKEN, a Cloudflare API token with Cloudflare Pages: Edit and DNS: Edit on ${zoneName}.`,
].join('\n')
const requestResponse = async <Result>(path: string, init: RequestInit = {}) => {
  const token = Bun.env.CLOUDFLARE_API_TOKEN
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN is missing.')
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (response.status === 404) {
    return
  }
  const body = await response.json() as CloudflareResponse<Result>
  if (!body.success) {
    const errors = body.errors.map(error => `${error.code} ${error.message}`).join(', ')
    throw new Error(`Cloudflare answered ${init.method ?? 'GET'} ${path} with HTTP ${response.status}: ${errors}`)
  }
  return body
}
const request = async <Result>(path: string, init: RequestInit = {}) => {
  const body = await requestResponse<Result>(path, init)
  return body?.result
}
const resolveAlias = (alias: string) => {
  // Cloudflare cuts preview aliases to 28 characters of lowercase letters, digits and hyphens.
  if (!/^[\da-z](?:[\d\-a-z]{0,26}[\da-z])?$/.test(alias)) {
    throw new TypeError(`${alias} is no preview alias.`)
  }
  return {
    hostname: `${alias}.${zoneName}`,
    target: `${alias}.${project}.pages.dev`,
  }
}
const domainPath = (hostname?: string) => `/accounts/${accountId}/pages/projects/${project}/domains${hostname ? `/${hostname}` : ''}`
const getRecords = async (hostname: string) => {
  const records = await request<Array<DnsRecord>>(`/zones/${zoneId}/dns_records?name.exact=${hostname}`)
  return records ?? []
}

export const attachPreviewDomain = async (alias: string, {timeout = 600_000} = {}) => {
  const {hostname, target} = resolveAlias(alias)
  const records = await getRecords(hostname)
  const foreignRecord = records.find(record => record.comment !== recordComment)
  if (foreignRecord) {
    throw new Error(`${hostname} already has a ${foreignRecord.type} record to ${foreignRecord.content} that this script does not manage.`)
  }
  const record = {
    type: 'CNAME',
    name: hostname,
    content: target,
    proxied: true,
    comment: recordComment,
  }
  const ownRecord = records.at(0)
  if (!ownRecord) {
    await request(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(record),
    })
    console.log(`Pointed ${hostname} to ${target}.`)
  } else if (ownRecord.type !== 'CNAME' || ownRecord.content !== target || !ownRecord.proxied) {
    await request(`/zones/${zoneId}/dns_records/${ownRecord.id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    })
    console.log(`Repointed ${hostname} to ${target}.`)
  }
  let domain = await request<PagesDomain>(domainPath(hostname))
  if (!domain) {
    domain = await request<PagesDomain>(domainPath(), {
      method: 'POST',
      body: JSON.stringify({name: hostname}),
    })
    console.log(`Added ${hostname} to the Pages project ${project}.`)
  }
  const deadline = Date.now() + timeout
  while (domain?.status !== 'active') {
    if (domain?.status === 'blocked' || domain?.status === 'error') {
      const reason = domain.verification_data?.error_message ?? domain.validation_data?.error_message ?? 'no reason given'
      throw new Error(`Cloudflare could not set up ${hostname} (${domain.status}): ${reason}`)
    }
    if (Date.now() > deadline) {
      throw new Error(`${hostname} is still ${domain?.status ?? 'missing'} after ${timeout / 1000} s.`)
    }
    await Bun.sleep(10_000)
    domain = await request<PagesDomain>(domainPath(hostname))
  }
  const url = `https://${hostname}`
  console.log(`${url} serves ${target}.`)
  return url
}

/** Resolves with the preview aliases served at a subdomain of the zone, like `pr-145` for pr-145.slop.gallery, with when Cloudflare added their domain. */
export const listPreviewDomains = async () => {
  const domains: Array<PagesDomain> = []
  for (let page = 1; ; page++) {
    const body = await requestResponse<Array<PagesDomain>>(`${domainPath()}?page=${page}`)
    domains.push(...body?.result ?? [])
    if (page >= (body?.result_info?.total_pages ?? 1)) {
      break
    }
  }
  const suffix = `.${zoneName}`
  return domains.filter(domain => domain.name.endsWith(suffix)).map(domain => ({
    alias: domain.name.slice(0, -suffix.length),
    createdOn: new Date(domain.created_on),
  }))
}

export const detachPreviewDomain = async (alias: string) => {
  const {hostname} = resolveAlias(alias)
  const domain = await request<PagesDomain>(domainPath(hostname), {method: 'DELETE'})
  if (domain !== undefined) {
    console.log(`Removed ${hostname} from the Pages project ${project}.`)
  }
  for (const record of await getRecords(hostname)) {
    if (record.comment !== recordComment) {
      console.log(`Kept the ${record.type} record of ${hostname} to ${record.content}, as this script does not manage it.`)
      continue
    }
    await request(`/zones/${zoneId}/dns_records/${record.id}`, {method: 'DELETE'})
    console.log(`Removed the ${record.type} record of ${hostname}.`)
  }
}

/** Resolves with the custom domain’s URL after `attach`. */
const main = async (command: 'attach' | 'detach', alias: string) => {
  if (command === 'attach') {
    return attachPreviewDomain(alias)
  }
  await detachPreviewDomain(alias)
}

export default main

if (import.meta.main) {
  const {positionals, values} = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    strict: true,
    options: {
      help: {type: 'boolean'},
    },
  })
  const [command, alias] = positionals
  if (values.help || !alias || positionals.length > 2 || command !== 'attach' && command !== 'detach') {
    console.log(help)
    process.exitCode = values.help ? 0 : 1
  } else {
    await main(command, alias)
  }
}
