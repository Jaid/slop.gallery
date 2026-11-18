import type {Plugin} from 'vite'

const fileName = 'robots.txt'
const source = `User-agent: *
Content-signal: search=yes, ai-input=yes, ai-train=yes
Allow: /
`

export default function robotsTxtPlugin(): Plugin {
  return {
    name: 'robots-txt',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName,
        source,
      })
    },
    configureServer(server) {
      server.middlewares.use(`/${fileName}`, (_request, response) => {
        response.setHeader('Content-Type', 'text/plain; charset=utf-8')
        response.end(source)
      })
    },
  }
}
