import type {PluginObject} from '@babel/core'

import {types as t} from '@babel/core'
import babel from '@rolldown/plugin-babel'
import hsl from 'okhsl'

/** The gallery authors its palettes in OkHSL, but a fixed color only needs its packed sRGB value in the browser. */
export const bakeOkhsl = (): PluginObject => ({
  name: 'bake-okhsl-integers',
  visitor: {
    CallExpression(path) {
      const callee = path.get('callee')
      if (!callee.isMemberExpression({computed: false}) || !callee.get('property').isIdentifier({name: 'integer'}) || !callee.get('object').referencesImport('okhsl', 'default')) {
        return
      }
      const args = path.node.arguments
      if (args.length === 3 && args.every(arg => t.isNumericLiteral(arg))) {
        path.replaceWith(t.numericLiteral(hsl.integer(args[0].value, args[1].value, args[2].value)))
      }
    },
  },
})

export default function bakeOkhslPlugin() {
  return babel({presets: [{
    preset: () => ({plugins: [bakeOkhsl]}),
    rolldown: {filter: {code: /from\s*["']okhsl["']/u}},
  }]})
}
