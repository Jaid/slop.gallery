# rolldown-plugin-jxl-headers

Cloudflare Pages serves JPEG XL images as `application/octet-stream`. This plugin emits a [`_headers`](https://developers.cloudflare.com/pages/configuration/headers/) file into the build output that serves them as `image/jxl` instead.

```ts
import {defineConfig} from 'rolldown'
import jxlHeaders from 'rolldown-plugin-jxl-headers'

export default defineConfig({
  plugins: [jxlHeaders()],
})
```

The same plugin also works in Vite’s `plugins` array. It emits the file during bundling, not during development. A `_headers` file in Vite’s public directory would conflict with the emitted one.
