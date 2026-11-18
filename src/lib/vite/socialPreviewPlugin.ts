import type {HtmlTagDescriptor, Plugin} from 'vite'

import {resolve} from 'node:path'
import {callbackify} from 'node:util'

import optis from 'optis'

const schema = optis().extendTyped<{
  optional: {
    /** Source image, absolute or relative to the Vite root. Without it, only text metadata is emitted. */
    cardImage: string
  }
}>()
type Site = {
  description: string
  displayName: string
  homepage: string
  socialPreview: {
    description: string
    imageAlt: string
    tagline: string
  }
}

const fileName = 'preview.jpg'
const width = 1200
const height = 630
const size = `${width}x${height}`
const encodeCard = async (path: string) => {
  const {stdout, stderr, exitCode} = await Bun.$`magick ${`${path}[0]`} -auto-orient -resize ${`${size}^`} -gravity center -extent ${size} -colorspace sRGB -strip -quality 85 jpeg:-`.nothrow().quiet()
  if (exitCode !== 0) {
    throw new Error(`Could not generate ${fileName} from ${path} with magick (exit code ${exitCode}): ${stderr.toString().trim()}`)
  }
  return stdout
}
const og = (property: string, content: string): HtmlTagDescriptor => ({
  tag: 'meta',
  attrs: {
    property: `og:${property}`,
    content,
  },
})

export default function socialPreviewPlugin({description, displayName, homepage, socialPreview}: Site, options?: optis.Parameter<typeof schema>): Plugin {
  const {cardImage} = schema.process(options)
  const imageUrl = new URL(fileName, homepage)
  let source: string | undefined
  return {
    name: 'social-preview',
    configResolved(config) {
      source = cardImage && resolve(config.root, cardImage)
    },
    async buildStart() {
      if (source && this.environment.mode === 'build') {
        this.addWatchFile(source)
        this.emitFile({
          type: 'asset',
          fileName,
          source: await encodeCard(source),
        })
      }
    },
    configureServer(server) {
      const path = source
      if (path) {
        const render = callbackify(encodeCard)
        server.middlewares.use(`/${fileName}`, (_request, response, next) => {
          render(path, (error: Error | null, bytes) => {
            if (error) {
              next(error)
              return
            }
            response.setHeader('Content-Type', 'image/jpeg')
            response.end(bytes)
          })
        })
      }
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            name: 'description',
            content: description,
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'canonical',
            href: homepage,
          },
        },
        og('type', 'website'),
        og('site_name', displayName),
        og('title', `${displayName} — ${socialPreview.tagline}`),
        og('description', socialPreview.description),
        og('url', homepage),
        ...source ? [
          og('image', imageUrl.href),
          og('image:width', String(width)),
          og('image:height', String(height)),
          og('image:alt', socialPreview.imageAlt),
        ] : [],
      ]
    },
  }
}
