import type {Plugin} from 'rolldown'

export const headersFileName = '_headers'
// Cloudflare Pages does not know JPEG XL yet and would serve it as application/octet-stream.
export const headers = `/*.jxl
  Content-Type: image/jxl
`

/** Emits a Cloudflare Pages `_headers` file that serves JXL images as image/jxl. */
export default function jxlHeadersPlugin(): Plugin {
  return {
    name: 'jxl-headers',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: headersFileName,
        source: headers,
      })
    },
  }
}
