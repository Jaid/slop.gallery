import {expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import usePauseMenu, {PauseMenu} from '../src/main.ts'
import {TestTarget} from './browser.ts'

function setup() {
  const menu = new PauseMenu
  const target = new TestTarget
  const disconnect = menu.attach(target.element)
  return {
    menu,
    target,
    document: target.ownerDocument,
    disconnect,
  }
}
test('construction and server rendering do not read or write storage', () => {
  let resolutions = 0
  const menu = new PauseMenu({
    storageKey: 'game',
    storage: () => {
      resolutions++
      throw new Error('No browser')
    },
  })
  function Menu() {
    return createElement('p', null, usePauseMenu(menu).stage)
  }
  expect(renderToStaticMarkup(createElement(Menu))).toBe('<p>first</p>')
  expect(resolutions).toBe(0)
  expect(Object.isFrozen(menu.getSnapshot())).toBe(true)
})
test('start marks a visit exactly once and preserves a stable server snapshot', () => {
  const values = new Map<string, string>
  let writes = 0
  const options = {
    storageKey: 'game',
    storage: () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes++
        values.set(key, value)
      },
    }),
  }
  const first = new PauseMenu(options)
  first.start()
  first.start()
  const attachedTarget = new TestTarget
  const disconnect = first.attach(attachedTarget.element)
  disconnect()
  const reattachedTarget = new TestTarget
  first.attach(reattachedTarget.element)()
  expect(writes).toBe(1)
  expect(first.getSnapshot().stage).toBe('first')
  const nextVisit = new PauseMenu(options)
  const server = nextVisit.getServerSnapshot()
  nextVisit.start()
  expect(nextVisit.getSnapshot().stage).toBe('return')
  expect(nextVisit.getServerSnapshot()).toBe(server)
  expect(server.stage).toBe('first')
  const otherGame = new PauseMenu({
    ...options,
    storageKey: 'other',
  })
  otherGame.start()
  expect(otherGame.getSnapshot().stage).toBe('first')
})
test('visit persistence is opt-in', () => {
  const menu = new PauseMenu({
    storage: () => {
      throw new Error('Must not be called')
    },
  })
  expect(() => menu.start()).not.toThrow()
  expect(menu.getSnapshot().stage).toBe('first')
})
test('reset distinguishes a returning visitor without a saved game, including async loading', () => {
  const values = new Map<string, string>
  const options = {
    storageKey: 'game',
    hasGameData: false,
    storage: () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    }),
  }
  const first = new PauseMenu(options)
  first.start()
  expect(first.getSnapshot().stage).toBe('first')
  const returning = new PauseMenu(options)
  returning.start()
  expect(returning.getSnapshot().stage).toBe('reset')
  const asyncMenu = new PauseMenu({
    ...options,
    hasGameData: undefined,
  })
  asyncMenu.start()
  expect(asyncMenu.getSnapshot().stage).toBe('return')
  asyncMenu.setGameData(false)
  expect(asyncMenu.getSnapshot().stage).toBe('reset')
  asyncMenu.setGameData(true)
  expect(asyncMenu.getSnapshot().stage).toBe('return')
  const target = new TestTarget
  asyncMenu.attach(target.element)
  target.ownerDocument.change(target)
  target.ownerDocument.change(null)
  asyncMenu.setGameData(false)
  expect(asyncMenu.getSnapshot().stage).toBe('pause')
})
test('saved-game availability can arrive before visit tracking starts', () => {
  const menu = new PauseMenu({initialStage: 'return'})
  menu.setGameData(false)
  menu.start()
  expect(menu.getSnapshot().stage).toBe('reset')
  const reset = new PauseMenu({initialStage: 'reset'})
  reset.start()
  expect(reset.getSnapshot().stage).toBe('reset')
})
test('a failed write preserves a successfully read visit', () => {
  const menu = new PauseMenu({
    storageKey: 'game',
    storage: () => ({
      getItem: () => 'true',
      setItem: () => {
        throw new Error('Quota')
      },
    }),
  })
  menu.start()
  expect(menu.getSnapshot().stage).toBe('return')
})
test('a failed storage read still attempts to mark this visit', () => {
  let written = false
  const menu = new PauseMenu({
    storageKey: 'game',
    storage: () => ({
      getItem: () => {
        throw new Error('Read failed')
      },
      setItem: () => {
        written = true
      },
    }),
  })
  menu.start()
  expect(written).toBe(true)
  expect(menu.getSnapshot().stage).toBe('first')
})
test('blocked storage preserves an application-provided returning visitor', () => {
  const menu = new PauseMenu({
    initialStage: 'return',
    storageKey: 'game',
    storage: () => {
      throw new Error('Blocked')
    },
  })
  menu.start()
  expect(menu.getSnapshot().stage).toBe('return')
})
test('subscribers get stable snapshots, no duplicate events and bound cleanup', () => {
  const {menu, document, target} = setup()
  let changes = 0
  const {subscribe, getSnapshot} = menu
  const unsubscribe = subscribe(() => {
    changes++
  })
  const initial = getSnapshot()
  document.change(null)
  expect(getSnapshot()).toBe(initial)
  document.change(target)
  const playing = getSnapshot()
  expect(playing).toEqual({
    stage: 'first',
    locked: true,
  })
  document.change(target)
  expect(getSnapshot()).toBe(playing)
  document.change(null)
  expect(getSnapshot()).toEqual({
    stage: 'pause',
    locked: false,
  })
  expect(changes).toBe(2)
  unsubscribe()
  document.change(target)
  expect(changes).toBe(2)
})
test('Escape and a consumed Escape key both produce pause', () => {
  for (const dispatchKey of [false, true]) {
    const {menu, document, target} = setup()
    document.change(target)
    if (dispatchKey) {
      document.escape()
    }
    document.change(null)
    expect(menu.getSnapshot()).toEqual({
      stage: 'pause',
      locked: false,
    })
  }
})
test('Windows-key-style blur remains unfocus even if focus returns before unlock', () => {
  const {menu, document, target} = setup()
  document.change(target)
  document.blur()
  document.focused = true
  document.escape()
  document.change(null)
  expect(menu.getSnapshot().stage).toBe('unfocus')
  document.change(target)
  document.change(null)
  expect(menu.getSnapshot().stage).toBe('pause')
})
test('hidden tabs, lost focus, removed targets and transferred locks are unfocus', () => {
  for (const cause of ['hidden', 'blur', 'removed', 'transfer']) {
    const {menu, document, target} = setup()
    document.change(target)
    document.escape()
    if (cause === 'hidden') {
      document.hide()
    }
    if (cause === 'blur') {
      document.focused = false
    }
    if (cause === 'removed') {
      target.isConnected = false
    }
    document.change(cause === 'transfer' ? new TestTarget(document) : null)
    expect(menu.getSnapshot().stage).toBe('unfocus')
  }
})
test('non-playing focus changes and unrelated locks preserve the initial menu', () => {
  const {menu, document} = setup()
  document.blur()
  document.escape()
  document.change(new TestTarget(document))
  document.change(null)
  expect(menu.getSnapshot()).toEqual({
    stage: 'first',
    locked: false,
  })
})
test('explicit releases default to unfocus and can request pause', () => {
  const {menu, document, target} = setup()
  document.change(target)
  menu.release()
  expect(document.exits).toBe(1)
  expect(menu.getSnapshot().locked).toBe(true)
  document.change(null)
  expect(menu.getSnapshot().stage).toBe('unfocus')
  document.change(target)
  menu.release('pause')
  document.change(null)
  expect(menu.getSnapshot().stage).toBe('pause')
})
test('release does not unlock other games or create stale release reasons', () => {
  const {menu, document, target} = setup()
  const other = new TestTarget(document)
  document.change(other)
  menu.release()
  expect(document.exits).toBe(0)
  document.change(target)
  document.change(null)
  expect(menu.getSnapshot().stage).toBe('pause')
})
test('release failures restore the previous inference state', () => {
  const {menu, document, target} = setup()
  document.change(target)
  document.exitError = new Error('Release failed')
  expect(() => menu.release()).toThrow('Release failed')
  document.change(null)
  expect(menu.getSnapshot().stage).toBe('pause')
})
test('enter requests synchronously, forwards options and waits for actual lock events', async () => {
  const {menu, target, document} = setup()
  const request = menu.enter({unadjustedMovement: true})
  expect(target.requests).toEqual([{unadjustedMovement: true}])
  expect(menu.getSnapshot().locked).toBe(false)
  await request
  expect(menu.getSnapshot().locked).toBe(false)
  document.change(target)
  expect(menu.getSnapshot().locked).toBe(true)
})
test('enter failures do not invent a pause or a successful lock', async () => {
  const {menu, target} = setup()
  target.request = async () => {
    throw new Error('Denied')
  }
  await expect(menu.enter()).rejects.toThrow('Denied')
  expect(menu.getSnapshot()).toEqual({
    stage: 'first',
    locked: false,
  })
  target.request = () => {
    throw new Error('Synchronous failure')
  }
  await expect(menu.enter()).rejects.toThrow('Synchronous failure')
  const unattachedMenu = new PauseMenu
  await expect(unattachedMenu.enter()).rejects.toThrow('Attach')
})
test('disconnect is idempotent, releases only its own lock and removes listeners', () => {
  const {menu, document, target, disconnect} = setup()
  document.change(target)
  disconnect()
  disconnect()
  expect(document.exits).toBe(1)
  expect(menu.getSnapshot()).toEqual({
    stage: 'unfocus',
    locked: false,
  })
  const snapshot = menu.getSnapshot()
  document.change(target)
  document.blur()
  document.change(null)
  expect(menu.getSnapshot()).toBe(snapshot)
})
test('stale cleanup cannot detach a replacement target', () => {
  const {menu, target, document, disconnect} = setup()
  const next = new TestTarget(document)
  const cleanup = menu.attach(next.element)
  disconnect()
  document.change(next)
  expect(menu.getSnapshot().locked).toBe(true)
  cleanup()
  expect(document.exits).toBe(1)
  document.change(target)
  expect(menu.getSnapshot().locked).toBe(false)
})
test('pending requests finishing after detach cannot leave an orphaned lock', async () => {
  const {menu, document, target, disconnect} = setup()
  let finish!: () => void
  target.request = () => {
    const lockRequest = Promise.withResolvers<void>()
    finish = lockRequest.resolve
    return lockRequest.promise
  }
  const pending = menu.enter()
  disconnect()
  document.change(target)
  finish()
  await pending
  expect(document.exits).toBe(1)
  expect(menu.getSnapshot().locked).toBe(false)
})
test('late completion does not release a replacement canvas’s lock', async () => {
  const {menu, document, target} = setup()
  let finish!: () => void
  target.request = () => {
    const lockRequest = Promise.withResolvers<void>()
    finish = lockRequest.resolve
    return lockRequest.promise
  }
  const pending = menu.enter()
  const next = new TestTarget(document)
  menu.attach(next.element)
  document.change(next)
  finish()
  await pending
  expect(document.exits).toBe(0)
  expect(menu.getSnapshot().locked).toBe(true)
})
test('React callback refs return attachment-owned cleanup', () => {
  const menu = new PauseMenu
  expect(menu.ref(null)).toBeUndefined()
  const target = new TestTarget
  const cleanup = menu.ref(target.element)!
  target.ownerDocument.change(target)
  expect(menu.getSnapshot().locked).toBe(true)
  cleanup()
  expect(menu.getSnapshot().locked).toBe(false)
})
test('each target uses its owner document rather than a global document', () => {
  const a = setup()
  const b = setup()
  a.document.change(a.target)
  b.document.blur()
  expect(a.menu.getSnapshot().locked).toBe(true)
  expect(b.menu.getSnapshot().locked).toBe(false)
  a.disconnect()
  expect(b.document.exits).toBe(0)
})
test('release without an attachment is a no-op', () => {
  expect(() => {
    const unattachedMenu = new PauseMenu
    unattachedMenu.release()
  }).not.toThrow()
})
test('replacing an attachment to the same locked canvas preserves the pending application release', () => {
  const {menu, target, document, disconnect} = setup()
  document.change(target)
  menu.attach(target.element)
  disconnect()
  document.change(null)
  expect(menu.getSnapshot()).toEqual({
    locked: false,
    stage: 'unfocus',
  })
})
test('duplicate lock notifications do not erase a pending release reason', () => {
  const {menu, target, document} = setup()
  document.change(target)
  menu.release()
  document.change(target)
  document.change(null)
  expect(menu.getSnapshot().stage).toBe('unfocus')
})
test('listeners added during a notification wait for the next transition', () => {
  const {menu, target, document} = setup()
  let later = 0
  menu.subscribe(() => {
    menu.subscribe(() => {
      later++
    })
  })
  document.change(target)
  expect(later).toBe(0)
  document.change(null)
  expect(later).toBe(1)
})
test.each(['first', 'return', 'reset'] as const)('pause opens directly from %s without ever requesting pointer lock', initialStage => {
  const menu = new PauseMenu({initialStage})
  const target = new TestTarget
  const disconnect = menu.attach(target.element)
  const snapshots: Array<ReturnType<typeof menu.getSnapshot>> = []
  menu.subscribe(() => snapshots.push(menu.getSnapshot()))
  menu.pause()
  const paused = menu.getSnapshot()
  expect(paused).toEqual({
    stage: 'pause',
    locked: false,
  })
  menu.pause()
  menu.setGameData(false)
  target.ownerDocument.blur()
  target.ownerDocument.escape()
  target.ownerDocument.change(null)
  expect(menu.getSnapshot()).toBe(paused)
  expect(snapshots).toEqual([paused])
  expect(target.requests).toEqual([])
  expect(target.ownerDocument.exits).toBe(0)
  disconnect()
  menu.attach(target.element)
  expect(menu.getSnapshot()).toBe(paused)
  // A later real entry resumes normally; a lost focus still has its own stage.
  target.ownerDocument.change(target)
  expect(menu.getSnapshot()).toEqual({
    stage: 'pause',
    locked: true,
  })
  target.ownerDocument.change(null)
  expect(menu.getSnapshot()).toEqual({
    stage: 'unfocus',
    locked: false,
  })
})
test('pausing before attachment starts the visit once and preserves the pause through start and attachment', () => {
  let writes = 0
  const menu = new PauseMenu({
    storageKey: 'game',
    storage: () => ({
      getItem: () => 'true',
      setItem: () => {
        writes++
      },
    }),
  })
  const server = menu.getServerSnapshot()
  menu.pause()
  const paused = menu.getSnapshot()
  menu.start()
  const target = new TestTarget
  menu.attach(target.element)
  expect(menu.getSnapshot()).toBe(paused)
  expect(paused).toEqual({
    stage: 'pause',
    locked: false,
  })
  expect(menu.getServerSnapshot()).toBe(server)
  expect(writes).toBe(1)
})
test('pause while playing waits for the real unlock and preserves the focus-loss priority', () => {
  for (const blur of [false, true]) {
    const {menu, target, document} = setup()
    document.change(target)
    if (blur) {
      document.blur()
    }
    const playing = menu.getSnapshot()
    menu.pause()
    expect(menu.getSnapshot()).toBe(playing)
    expect(document.exits).toBe(1)
    document.change(null)
    expect(menu.getSnapshot()).toEqual({
      stage: blur ? 'unfocus' : 'pause',
      locked: false,
    })
  }
})
