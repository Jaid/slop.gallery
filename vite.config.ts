import type {AcceptedPlugin} from 'postcss'
import type {ConfigEnv, UserConfig, UserConfigFn} from 'vite'

import reactPlugin from '@vitejs/plugin-react'
import postcssAutoprefixer from 'autoprefixer'
import cssnano from 'cssnano-preset-advanced'
import postcssNormalize from 'postcss-normalize'
import bakeBranchComponentPlugin from 'rolldown-plugin-bake-branch-component'
import hoistPopularConstantsPlugin from 'rolldown-plugin-hoist-popular-constants'
import thematicChunksPlugin from 'rolldown-plugin-thematic-chunks'
import {deprecations as sassDeprecations} from 'sass-embedded'
import {loadEnv, mergeConfig} from 'vite'
import bakeThreePlugin from 'vite-plugin-bake-three'
import browserslistTargetPlugin from 'vite-plugin-browserslist-target'
import importVoiceSamplePlugin from 'vite-plugin-import-voice-sample'
import jxlPlugin from 'vite-plugin-jxl'
import jxlHeadersPlugin from 'vite-plugin-jxl-headers'
import loadingScreenPlugin from 'vite-plugin-loading-screen'
import mediaMixinsPlugin from 'vite-plugin-media-mixins'
import titlePlugin from 'vite-plugin-title'

import immutableHeadersPlugin from '#src/lib/vite/immutableHeadersPlugin.ts'
import outputListPlugin from '#src/lib/vite/outputListPlugin.ts'
import rapierWasmPlugin from '#src/lib/vite/rapierWasmPlugin.ts'
import worldChunksPlugin from '#src/lib/vite/worldChunksPlugin.ts'
import {defaultWorld, selectWorld, worldIds, worldParameters, worldRooms, worlds} from '#src/worlds/index.ts'

const getCommonConfig = (context: ConfigEnv) => {
  const env = loadEnv(context.mode, process.cwd(), '')
  const config: UserConfig = {
    build: {
      chunkSizeWarningLimit: 5000,
      assetsInlineLimit: 128,
    },
    plugins: [
      browserslistTargetPlugin(),
      importVoiceSamplePlugin({
        // The Knots’ announcements in Grok’s Iris voice cost an OpenRouter request each, so only VOICE_SAMPLES=true includes them; without them, the browser’s own voice reads the titles.
        enabled: env.VOICE_SAMPLES === 'true',
        // A sample that cannot be fetched is read by the browser’s voice as well.
        optional: true,
      }),
      titlePlugin(worlds[defaultWorld].title),
      // Every world shares one page, so the loading screen picks the world from the URL with the same function the app picks it with.
      loadingScreenPlugin({
        screens: worlds,
        defaultScreen: defaultWorld,
        select: selectWorld,
        selectorArguments: [worldParameters, worldRooms],
        fontFamily: 'main, system-ui, sans-serif',
      }),
      reactPlugin({compiler: true}),
      mediaMixinsPlugin(),
    ],
    css: {
      postcss: {
        plugins: [
          postcssNormalize() as unknown as AcceptedPlugin,
          postcssAutoprefixer,
        ],
      },
      preprocessorOptions: {
        sass: {
          // What Dart Sass 2 will remove fails the build already.
          fatalDeprecations: sassDeprecations.dartSass2,
        },
      },
    },
  }
  return config
}
const getDevelopmentConfig = (context: ConfigEnv) => {
  const config: UserConfig = {
    build: {
      outDir: `out/build/${context.mode}`,
      sourcemap: true,
    },
  }
  return config
}
const getProductionConfig = () => {
  // Fonts, animation names and stacking levels can also be referenced from JavaScript.
  const cssnanoPlugins = cssnano({
    discardUnused: false,
    reduceIdents: false,
    mergeIdents: false,
    zindex: false,
  }).plugins.filter(([, options]) => !(options && 'exclude' in options && options.exclude)).map(([createPlugin, options]) => createPlugin(options))
  const worldChunks = worldChunksPlugin(Object.fromEntries(worldIds.map(id => [id, `src/worlds/${id}/index.ts`])))
  const config: UserConfig = {
    plugins: [
      jxlPlugin(),
      jxlHeadersPlugin(),
      immutableHeadersPlugin(),
      outputListPlugin(),
      rapierWasmPlugin(),
      // Only recipes that take longer to generate than their snapshots take to download; the rest load sooner without them.
      bakeThreePlugin({
        geometry: {
          include: [
            'src/components/Architecture/index.tsx',
            'src/lib/gallery/OculusGroundGeometry.ts',
            'src/lib/gallery/moonfall/CraterGeometry.ts',
            // The lattice is quicker to build than to download.
            {
              glob: 'src/lib/gallery/antechamberDome.ts',
              scope: 'antechamberDomeGeometry',
            },
          ],
        },
        staticTextures: {
          include: [
            'packages/knot-materials/src/entries/{great_cat_emergence,felidae_nocturne}/Material.ts',
            'packages/knot-materials/src/candidates/{claude_haiku/lib/knotArcLength,deepseek/lib/interference}.ts',
          ],
        },
        // No region of the worlds is closed and static enough for it.
        staticRendering: false,
      }),
      bakeBranchComponentPlugin(),
      {
        ...hoistPopularConstantsPlugin(),
        apply: 'build',
        enforce: 'post',
      },
      worldChunks,
      thematicChunksPlugin(),
    ],
    build: {
      outDir: 'dist',
      assetsDir: '',
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2_000_000,
      minify: 'terser',
      rolldownOptions: {
        preserveEntrySignatures: false,
        treeshake: {
          // Three.js uses getters with observable behavior.
          propertyReadSideEffects: 'always',
        },
        optimization: {
          inlineConst: {
            mode: 'all',
            pass: 100,
          },
        },
        output: {
          minify: true,
          topLevelVar: true,
          codeSplitting: {
            groups: [
              ...worldChunks.groups,
              {
                // The Knots’ metadata, which every material reads its own entry from, in one chunk instead of one per entry; it only loads with the first Knot.
                name: 'knot-catalog',
                test: /[/\\]knot-materials[/\\]src[/\\](?:(?:candidates|entries)[/\\](?:[^/\\]+[/\\]data|index)\.ts$|main\.ts$|rarities\.ts$|KnotCandidate\.ts$)/u,
                priority: 9,
                // Only the metadata itself, not what it imports, which other chunks share.
                includeDependenciesRecursively: false,
              },
              {
                // The helpers the Knots’ shaders share, the package’s and each candidate’s, loaded once with the first material that needs them, with what only they need, like the textures baked for them.
                // Below the chunks of packages and libraries, which keep what the page shares with them.
                name: 'knot-shaders',
                test: /[/\\]knot-materials[/\\]src[/\\](?:candidates[/\\][^/\\]+[/\\])?lib[/\\]/u,
                priority: 1,
              },
            ],
          },
          // Every file but the page is named by its content, so browsers can keep it for good and a deploy can never leave them running stale chunks under the same name; see immutableHeadersPlugin. The build’s output list (outputListPlugin) tells which is which.
          entryFileNames: '[hash:8].js',
          chunkFileNames: '[hash:8].js',
          assetFileNames: '[hash:8].[ext]',
        },
        checks: {
          pluginTimings: false,
        },
      },
    },
    css: {
      postcss: {
        plugins: cssnanoPlugins,
      },
    },
  }
  return config
}
const config: UserConfigFn = context => mergeConfig(getCommonConfig(context), (context.mode === 'production' ? getProductionConfig : getDevelopmentConfig)(context))

export default config
