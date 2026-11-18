import type {HtmlTagDescriptor} from 'vite'

/** Receives the attributes of one output script. Returning false keeps it in the HTML. */
export type DeferScript = (attributes: Readonly<Record<string, string | undefined>>) => boolean

const marker = 'data-loading-screen-script'
// Templates retain each script’s position and attributes without fetching or executing it.
// Start the app after the splash is installed, not after it is dismissed: the app dismisses it.
const restore = String.raw`(async () => {
  for (const slot of document.querySelectorAll('template[${marker}]')) {
    const script = document.createElement('script')
    script.async = false
    for (const {name, value} of slot.attributes) {
      if (name !== '${marker}') script.setAttribute(name, value)
    }
    if (slot.nonce) script.nonce = slot.nonce
    script.textContent = slot.content.textContent
    const blocking = script.src && !script.noModule && !script.async && !script.defer && (!script.type || /^(text|application)\/(java|ecma)script$/i.test(script.type))
    const loaded = blocking && new Promise(resolve => {
      script.addEventListener('load', resolve, {once: true})
      script.addEventListener('error', resolve, {once: true})
    })
    slot.replaceWith(script)
    if (loaded) await loaded
  }
})()`

export default function deferScripts(html: string, tags: Array<HtmlTagDescriptor>, deferScript?: DeferScript) {
  const rewriter = new HTMLRewriter
  let deferred = false
  let deferredCount = 0
  let templateDepth = 0
  rewriter.on('template', {
    element(template) {
      templateDepth++
      template.onEndTag(() => {
        templateDepth--
      })
    },
  })
  rewriter.on('script', {
    element(script) {
      deferred = !templateDepth && script.namespaceURI === 'http://www.w3.org/1999/xhtml' && (deferScript?.(Object.fromEntries(script.attributes)) ?? true)
      if (deferred) {
        deferredCount++
        script.tagName = 'template'
        script.setAttribute(marker, '')
      }
    },
    text(chunk) {
      // Script text is raw; template text must escape markup and ampersands to round-trip.
      if (deferred) {
        chunk.replace(chunk.text, {html: false})
      }
    },
  })
  const transformed = rewriter.transform(html)
  if (deferredCount) {
    tags.push({
      tag: 'script',
      children: restore,
      injectTo: 'body',
    })
  }
  return {
    html: transformed,
    tags,
  }
}
