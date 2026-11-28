import type {BakeAdapter} from '../src/types.ts'
import type {NodePath} from '@babel/traverse'
import type {CallExpression, NewExpression} from '@babel/types'

import {afterAll, expect, test} from 'bun:test'
import {join, resolve} from 'node:path'

import fs from 'fs-extra'

import Recipe from '../src/Recipe.ts'
import {decodeSnapshot} from '../src/runtime.ts'
import SnapshotWriter from '../src/SnapshotWriter.ts'
import SourceGraph from '../src/SourceGraph.ts'

class Resource<Value = unknown> {
  constructor(public data: Value) {}
}
const adapter: BakeAdapter = {
  name: 'test',
  modules: new Map([
    ['test:resources', {Resource}],
    ['test:random', {random: () => Math.random()}],
  ]),
  roots: new Set([Resource]),
  types: [{
    name: 'Resource',
    module: 'test:resources',
    prototype: Resource.prototype,
    resource: 'test',
  }],
  accepts: resources => resources.has('test'),
}
const temporary = resolve(import.meta.dir, '../../../../../temp/plugin-tests')
await fs.ensureDir(temporary)
const directory = await fs.mkdtemp(join(temporary, 'bake-recipes-'))
afterAll(() => fs.rm(directory, {
  recursive: true,
  force: true,
}))
const graph = new SourceGraph(async (source, importer) => resolve(importer, '..', source))
async function evaluate(code: string, timeout = 1000, allowFreezingRandomness = false) {
  const source = await graph.input(join(directory, 'input.ts'), `import {Resource} from 'test:resources';\n${code}`)
  const path = source.path.scope.getBinding('result')!.path.get('init') as NodePath<CallExpression | NewExpression>
  const inputRecipe = new Recipe(graph, adapter, allowFreezingRandomness)
  return inputRecipe.evaluate(path, timeout)
}
function roundTrip(result: Awaited<ReturnType<typeof evaluate>>) {
  const writer = new SnapshotWriter(adapter, 1024 * 1024, result.isShared, result.rootPrototype)
  return decodeSnapshot(writer.write(result.value), {Resource})
}
test('evaluates locally mutable algorithms and strips TypeScript', async () => {
  const evaluated = await evaluate(`
    function build(seed: number): Resource {
      const next = () => ++seed
      const values: number[] = []
      for (let i = 0; i < 4; i++) values.push(next())
      return new Resource(values)
    }
    const result = build(7)
  `)
  expect((roundTrip(evaluated)() as Resource).data).toEqual([8, 9, 10, 11])
})
test('binds parameter properties and ignores local type aliases', async () => {
  const result = await evaluate(`
    class Flight {
      readonly steps: number
      constructor(readonly id: string, readonly rise: number, count = 2) {
        this.steps = rise * count
      }
    }
    function build(): Resource {
      type Step = {height: number}
      const flight = new Flight('north', 3)
      const steps: Array<Step> = [{height: flight.steps}]
      return new Resource([flight.id, ...steps.map((step): Step['height'] => step.height)])
    }
    const result = build()
  `)
  expect((roundTrip(result)() as Resource).data).toEqual(['north', 6])
})
test('follows aliased imports and re-exports without executing the application module', async () => {
  await fs.writeFile(join(directory, 'source.ts'), `
    import {Resource} from 'test:resources'
    throw new Error('Module side effect must NOT execute at build time')
    export const width = 17
    export function create() { return new Resource(width) }
  `)
  await fs.writeFile(join(directory, 'barrel.ts'), "export {create as make} from './source.ts'")
  const result = await evaluate("import {make as alias} from './barrel.ts'; const result = alias()")
  expect((roundTrip(result)() as Resource).data).toBe(17)
  expect([...result.dependencies].some(path => path.endsWith('source.ts'))).toBe(true)
})
test('declines live imports written in the exporter or mutated in the importer', async () => {
  await fs.writeFile(join(directory, 'settings.ts'), 'export let width = 1; width++; export default {height: 2}')
  await expect(evaluate("import {width} from './settings.ts'; const result = new Resource(width)")).rejects.toThrow('Mutable binding: width')
  await expect(evaluate("import settings from './settings.ts'; settings.height++; const result = new Resource(settings.height)")).rejects.toThrow('Mutated dependency: settings')
})
test('supports static destructuring and helper functions', async () => {
  const result = await evaluate('const {x, y} = {x: 3, y: 7}; const result = new Resource(x * y)')
  expect((roundTrip(result)() as Resource).data).toBe(21)
})
test('provides deterministic math modules to every adapter', async () => {
  const code = `
    import {clamp} from 'math'
    import {simplex2d} from 'math/noise'
    import * as mathRandom from 'math/random'
    const result = (() => {
      const state = mathRandom.mulberry32.create(7)
      const noise = simplex2d.create(31)
      return new Resource([
        clamp(4, 0, 2),
        mathRandom.mulberry32.sample(state),
        simplex2d.sample(noise, 0.25, -0.75),
        mathRandom.random.int(() => 0.5, 1, 5),
      ])
    })()
  `
  const first = (roundTrip(await evaluate(code))() as Resource<Array<number>>).data
  const second = (roundTrip(await evaluate(code))() as Resource<Array<number>>).data
  expect(first).toEqual(second)
  expect(first[0]).toBe(2)
  expect(first[3]).toBe(3)
})
test('requires opt-in before freezing free randomness', async () => {
  await expect(evaluate(`
    import {mulberry32} from 'math/random'
    const result = new Resource(mulberry32.seed())
  `)).rejects.toThrow('allowFreezingRandomness')
  const direct = (roundTrip(await evaluate('const result = new Resource(Math.random())', 1000, true))() as Resource<number>).data
  expect(direct).toBeGreaterThanOrEqual(0)
  expect(direct).toBeLessThan(1)
  const seeded = (roundTrip(await evaluate(`
    import {mulberry32} from 'math/random'
    const result = new Resource(mulberry32.seed())
  `, 1000, true))() as Resource<number>).data
  expect(seeded).toBeInteger()
  expect(seeded).toBeGreaterThanOrEqual(0)
  expect(seeded).toBeLessThanOrEqual(0xFF_FF_FF_FF)
})
test.each([
  ['clock', 'const result = new Resource(Date.now())'],
  ['random', 'const result = new Resource(Math.random())'],
  ['indirect random', "const method = 'ran' + 'dom'; const result = new Resource(Math[method]())"],
  ['browser state', 'const result = new Resource(window.innerWidth)'],
  ['mutable binding', 'let n = 0; n++; const result = new Resource(n)'],
  ['captured buffer mutation', 'const data = new Uint8Array(4); data[0] = 7; const result = new Resource(data)'],
  ['captured state mutation', 'const settings = {x: 1}; const make = () => { settings.x++; return new Resource(3) }; const result = make()'],
  ['captured alias', 'const shared = new Resource(1); const result = (() => shared)()'],
  ['stateful captured closure', 'const next = (() => {let n = 0; return () => n++})(); const result = new Resource(next())'],
  ['unknown import', "import read from 'node:fs'; const result = new Resource(read.readFileSync('secret'))"],
  ['accessor', 'const settings = {get value() { return 2 }}; const result = new Resource(settings.value)'],
  ['asynchronous recipe', 'const make = async () => new Resource(1); const result = make()'],
  ['private class state', 'class Private extends Resource { #value = 1 }; const result = new Private(1)'],
])('declines %s', async (_label, code) => {
  await expect((async () => roundTrip(await evaluate(code)))()).rejects.toThrow()
})
test('declines a resource built from an open runtime parameter', async () => {
  // A dynamic function argument is legal inside a closed invocation; reject an actually open parameter.
  const source = await graph.input(join(directory, 'parameter.ts'), "import {Resource} from 'test:resources'; function component(size) { return new Resource(size) }")
  let path!: NodePath<NewExpression>
  source.path.traverse({NewExpression(value) {
    path = value
  }})
  const parameterRecipe = new Recipe(graph, adapter)
  await expect(parameterRecipe.evaluate(path, 1000)).rejects.toThrow()
})
test('keeps approved native random methods behind the same opt-in', async () => {
  const code = `
    import * as native from 'test:random'
    const result = new Resource(native.random())
  `
  await expect(evaluate(code)).rejects.toThrow('Nondeterministic or reflective native access')
  const value = (roundTrip(await evaluate(code, 1000, true))() as Resource<number>).data
  expect(value).toBeGreaterThanOrEqual(0)
  expect(value).toBeLessThan(1)
})
test('does not confuse a shadowed constructor with an imported resource', async () => {
  await expect(evaluate('const result = (() => { const Resource = (x) => x; return Resource(1) })()')).rejects.toThrow('Not a recognized resource')
})
/** A recipe whose resource depends on a chain of `count` constant declarations. */
function chainedRecipe(count: number) {
  return [
    'const value0 = 1',
    ...Array.from({length: count - 1}, (_, index) => `const value${index + 1} = value${index} + 1`),
    `const result = new Resource(value${count - 1})`,
  ].join('\n')
}
test('follows recipes through hundreds of declarations, but not through thousands', async () => {
  const evaluated = await evaluate(chainedRecipe(400))
  expect((roundTrip(evaluated)() as Resource<number>).data).toBe(400)
  await expect(evaluate(chainedRecipe(2000))).rejects.toThrow('Recipe dependency limit exceeded.')
})
test('limits runaway recipes', async () => {
  await expect(evaluate('const result = (() => { while (true) {} return new Resource(1) })()', 10)).rejects.toThrow()
})
test('keeps aliases within a snapshot but never between factory calls', async () => {
  const evaluated = await evaluate(`
    const result = (() => {
      const array = new Float32Array([1, 2, 3, 4])
      const object = {array, same: array, view: array.subarray(1, 3)}
      return new Resource(object)
    })()
  `)
  const create = roundTrip(evaluated)
  const first = create() as Resource<{
    array: Float32Array
    same: Float32Array
    view: Float32Array
  }>
  const second = create() as Resource<{
    array: Float32Array
    same: Float32Array
    view: Float32Array
  }>
  expect(first).toBeInstanceOf(Resource)
  expect(first.data.array).toBe(first.data.same)
  expect(first.data.array.buffer).toBe(first.data.view.buffer)
  expect(first.data.array.buffer).not.toBe(second.data.array.buffer)
  first.data.view[0] = 20
  expect(first.data.array[1]).toBe(20)
  expect(second.data.array[1]).toBe(2)
})
test('preserves special numbers, null prototypes, maps and cycles', async () => {
  const evaluated = await evaluate(`
    const result = (() => {
      const data = Object.create(null)
      data.values = [NaN, Infinity, -Infinity, -0, undefined]
      data.self = data
      data.map = new Map([[data, 7]])
      return new Resource(data)
    })()
  `)
  type Data = {
    map: Map<Data, number>
    self: Data
    values: Array<number | undefined>
  }
  const value = (roundTrip(evaluated)() as Resource<Data>).data
  expect(Object.getPrototypeOf(value)).toBe(null)
  expect(value.self).toBe(value)
  expect(value.map.get(value)).toBe(7)
  expect(Number.isNaN(value.values[0])).toBe(true)
  expect(Object.is(value.values[3], -0)).toBe(true)
})
test('reads captured arrays through non-mutating Array algorithms', async () => {
  const result = await evaluate('const values = [1, 2, 3]; const result = new Resource(values.map(value => value * 3))')
  expect((roundTrip(result)() as Resource).data).toEqual([3, 6, 9])
})
test('declines mutation through a const alias', async () => {
  await expect(evaluate('const settings = {x: 1}; const alias = settings; alias.x = 2; const result = new Resource(settings.x)')).rejects.toThrow()
})
test('declines Object.assign into captured configuration', async () => {
  await expect(evaluate('const settings = {x: 1}; Object.assign(settings, {x: 2}); const result = new Resource(settings.x)')).rejects.toThrow()
})
