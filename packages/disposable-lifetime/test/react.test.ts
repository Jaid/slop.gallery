import type useDisposable from '../src/react/useDisposable.ts'

import {beforeEach, expect, mock, test} from 'bun:test'
import {resolve} from 'node:path'

const hooks = `
let memoValue, memoDeps, effectDeps, pending, active, cleanup;
const changed = (a, b) => !a || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
export function useMemo(factory, next) {
  if (changed(memoDeps, next)) {
    memoValue = factory();
    memoDeps = next;
  }
  return memoValue;
}
export function useEffect(effect, next) {
  if (changed(effectDeps, next)) pending = {effect, deps: next};
}
export function commit() {
  if (!pending) return;
  cleanup?.();
  active = pending.effect;
  effectDeps = pending.deps;
  pending = null;
  cleanup = active();
}
export function replay() {
  cleanup?.();
  cleanup = active();
}
export function unmount() {
  cleanup?.();
  cleanup = null;
}
export function reset() {
  unmount();
  memoValue = undefined;
  memoDeps = undefined;
  effectDeps = undefined;
  pending = undefined;
  active = undefined;
}
`
const build = await Bun.build({
  entrypoints: ['fixture-entry'],
  target: 'bun',
  plugins: [
    {
      name: 'isolated-disposable-hooks',
      setup(builder) {
        builder.onResolve({filter: /^fixture-entry$/u}, () => ({
          path: 'entry',
          namespace: 'fixture',
        }))
        builder.onResolve({filter: /^react$/u}, () => ({
          path: 'react',
          namespace: 'fixture',
        }))
        builder.onLoad({
          filter: /.*/u,
          namespace: 'fixture',
        }, ({path}) => ({
          loader: 'js',
          contents: path === 'react' ? hooks : `
            export {default} from ${JSON.stringify(resolve(import.meta.dir, '../src/react/useDisposable.ts').replaceAll('\\\\', '/'))};
            export {commit, replay, reset, unmount} from 'react';
          `,
        }))
      },
    },
  ],
})
if (!build.success) {
  throw new AggregateError(build.logs, 'Hook fixture build failed.')
}
const harness = await import(`data:text/javascript;base64,${Buffer.from(await build.outputs[0].text()).toBase64()}`) as {
  commit: () => void
  default: typeof useDisposable
  replay: () => void
  reset: () => void
  unmount: () => void
}
beforeEach(() => harness.reset())
test('StrictMode effect replay keeps the mounted resource alive until final unmount', async () => {
  const dispose = mock(() => {})
  const resource = {dispose}
  expect(harness.default(resource)).toBe(resource)
  harness.commit()
  harness.replay()
  await Promise.resolve()
  expect(dispose).not.toHaveBeenCalled()
  harness.unmount()
  await Promise.resolve()
  expect(dispose).toHaveBeenCalledTimes(1)
})
test('dependency replacement disposes only the replaced resource', async () => {
  const disposeOld = mock(() => {})
  const disposeNew = mock(() => {})
  const oldResource = {dispose: disposeOld}
  const newResource = {dispose: disposeNew}
  harness.default(oldResource)
  harness.commit()
  harness.default(newResource)
  harness.commit()
  await Promise.resolve()
  expect(disposeOld).toHaveBeenCalledTimes(1)
  expect(disposeNew).not.toHaveBeenCalled()
  harness.unmount()
  await Promise.resolve()
  expect(disposeNew).toHaveBeenCalledTimes(1)
})
test('an optional resource can appear and disappear without a placeholder', async () => {
  expect(harness.default(undefined)).toBeUndefined()
  harness.commit()
  const resource = {dispose: mock(() => {})}
  harness.default(resource)
  harness.commit()
  harness.default(undefined)
  harness.commit()
  await Promise.resolve()
  expect(resource.dispose).toHaveBeenCalledTimes(1)
})
