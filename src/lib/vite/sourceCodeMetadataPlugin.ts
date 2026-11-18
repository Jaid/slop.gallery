import type {Plugin} from 'vite'

type GalleryManifest = {
  displayName: string
  license: string
  repository?: {url: string} | string
}

export default function sourceCodeMetadataPlugin({displayName, license, repository}: GalleryManifest): Plugin {
  const url = typeof repository === 'string' ? repository : repository?.url
  return {
    name: 'source-code-metadata',
    transformIndexHtml() {
      if (!url) {
        return
      }
      const metadata = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: displayName,
        codeRepository: url.replace(/^git\+/u, '').replace(/\.git$/u, ''),
        programmingLanguage: 'TypeScript',
        license: `https://opensource.org/licenses/${license}`,
        targetProduct: {
          '@type': 'VideoGame',
          name: displayName,
          url: 'https://slop.gallery/',
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
