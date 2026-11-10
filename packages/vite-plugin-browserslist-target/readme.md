# vite-plugin-browserslist-target

Infer Vite’s `build.target` from the project’s Browserslist configuration instead of maintaining a separate browser version in `vite.config.ts`.

```typescript
import {defineConfig} from 'vite'
import browserslistTargetPlugin from 'vite-plugin-browserslist-target'

export default defineConfig({
  plugins: [browserslistTargetPlugin()],
})
```

The plugin uses Vite’s `config` hook and takes no options. Browserslist searches from Vite’s root (or the working directory when no root is set), including parent directories. It supports `.browserslistrc`, `browserslist` files and the `browserslist` field in `package.json`, with Browserslist’s usual defaults when no configuration exists.

Standard `BROWSERSLIST`, `BROWSERSLIST_CONFIG`, `BROWSERSLIST_ENV` and `NODE_ENV` behavior is preserved. Vite’s `mode` is not substituted for Browserslist’s environment selection, so other Browserslist consumers retain the same interpretation.

`browserslist-to-esbuild` converts browser names and version ranges to the target strings also accepted by Vite 8’s Oxc transformer. For example, `Chrome >= 155` becomes `['chrome155']`. An empty conversion throws rather than silently disabling target constraints.

An explicitly configured `build.target` always takes precedence. The plugin leaves `build.cssTarget` untouched: Vite normally inherits it from `build.target`, and explicit CSS overrides remain intact. It does not change development transforms, dependency optimization targets or add runtime polyfills.
