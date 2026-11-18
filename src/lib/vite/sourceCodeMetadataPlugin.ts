import type {Plugin} from 'vite'

import fs from 'fs-extra'

type GalleryManifest = {
  displayName: string
  homepage: string
  license: string
  repository?: {url: string} | string
}

export default function sourceCodeMetadataPlugin({displayName, homepage, license, repository}: GalleryManifest, packageFolder: string): Plugin {
  const url = typeof repository === 'string' ? repository : repository?.url
  return {
    name: 'source-code-metadata',
    async transformIndexHtml() {
      if (!url) {
        return
      }
      const codeRepository = url.replace(/^git\+/u, '').replace(/\.git$/u, '')
      const files = await fs.readdir(packageFolder, {withFileTypes: true})
      const licenseFile = files.filter(file => file.isFile() && /^license\.(?:html|md|txt)$/iu.test(file.name)).map(file => file.name).toSorted()[0]
      const metadata = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: displayName,
        codeRepository,
        programmingLanguage: 'TypeScript',
        license: licenseFile ? `${codeRepository}/blob/main/${licenseFile}` : `https://opensource.org/licenses/${license}`,
        targetProduct: {
          '@type': 'VideoGame',
          name: displayName,
          url: homepage,
        },
      }
      return [{
        tag: 'script',
        attrs: {type: 'application/ld+json'},
        children: JSON.stringify(metadata).replaceAll('<', String.raw`\u003c`),
        injectTo: 'head',
      }]
    },
  }
}
