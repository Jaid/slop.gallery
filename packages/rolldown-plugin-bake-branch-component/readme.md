# rolldown-plugin-bake-branch-component

Compile `branch-component` JSX through `babel-plugin-bake-branch-component` and `@rolldown/plugin-babel`, removing the runtime component when compilation succeeds.

## Rolldown

```typescript
import {defineConfig} from 'rolldown'
import bakeBranchComponent from 'rolldown-plugin-bake-branch-component'

export default defineConfig({
  input: 'src/main.tsx',
  plugins: [bakeBranchComponent()],
  output: {dir: 'dist', format: 'es'},
})
```

The factory returns the asynchronous Rolldown Babel plugin. Supply it before other plugins that lower JSX. The existing Babel compilation rules, source maps and runtime behavior are unchanged.

## Vite

Keep this plugin in Vite’s top-level `plugins` array, where the official Babel wrapper preserves its early JSX-transform ordering. List it before `@vitejs/plugin-react`, whose React Compiler lowers JSX in an early transform of its own:

```typescript
import reactPlugin from '@vitejs/plugin-react'
import {defineConfig} from 'vite'
import bakeBranchComponent from 'rolldown-plugin-bake-branch-component'

export default defineConfig({
  plugins: [bakeBranchComponent(), reactPlugin({compiler: true})],
})
```

For production-only compilation, include it only in production builds, still before the React plugin, as the gallery does. Do not move it behind JSX lowering as an output-only transformation.
