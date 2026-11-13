# use-pause-menu

Headless pause-menu behavior for pointer-lock games. One small controller owns browser integration and visit history; a React hook subscribes to its immutable snapshot. No Three.js, Fiber, Zustand, CSS, rendering or game-reset dependency.

## React

```tsx
import usePauseMenu, {PauseMenu} from 'use-pause-menu'

const menu = new PauseMenu({storageKey: 'my-game:visited'})

export default function Game() {
  const {stage, locked} = usePauseMenu(menu)
  return <>
    <canvas ref={menu.ref}/>
    {!locked && <section>
      <h1>{stage === 'first' ? 'Welcome' : 'My game'}</h1>
      <button onClick={() => void menu.enter().catch(console.error)}>
        {stage === 'first' ? 'Enter' : stage === 'return' ? 'Continue' : 'Resume'}
      </button>
      {stage !== 'unfocus' && <p>Your game’s settings go here.</p>}
    </section>}
  </>
}
```

Create one controller per game/page visit, outside render or in a lazy `useState` initializer. Share it between the renderer, menu and commands. Multiple hook consumers share one snapshot and visit; no provider is required. Do not construct a controller on every render. In an SSR server, create controllers per request rather than sharing mutable sessions between visitors.

The hook starts visit tracking in an effect, even before a canvas is ready. Construction and server rendering never touch storage. `menu.start()` can also be called during client bootstrap to resolve the initial visit before the first render. It is idempotent across hook consumers and Strict Mode effect replay.

React is an optional peer for the framework-free core entry; it is required when importing the root entry or using the hook. The package targets React 19 and modern browsers, exports ESM TypeScript source and is not published yet.

## Stages

| Stage | Meaning |
| --- | --- |
| `first` | This page visit has not been recognized as a returning visitor. |
| `return` | A previous visit was recorded, or the application supplied `initialStage: 'return'`. |
| `reset` | A previous visit was recorded, but the application reports no stored game data. |
| `pause` | Pointer lock was released by Escape or `release('pause')`. |
| `unfocus` | Focus was lost, the canvas disappeared, lock transferred elsewhere or the application called `release()`. |

`locked` refers only to the attached element, not any element in the document. It changes on actual pointer-lock events, not optimistically when a request is made. While locked, `stage` retains the last menu stage. Render an overlay using `!locked`, not by checking whether `stage` exists. Other visibility conditions, such as a separate inventory panel, are the game’s responsibility. This package does not pause physics, audio or your render loop automatically: a game that wants to, for example only under the `pause` stage while leaving `unfocus` running, subscribes and stops them itself (`!locked && stage === 'pause'`).

The browser does not expose the reason for `pointerlockchange` and may consume Escape. A release while the document is focused and visible, the target is connected and no application release is pending is inferred to be Escape. Blur, hidden tabs, disconnected targets and transfers take precedence. Calling the native `document.exitPointerLock()` directly bypasses that intent tracking and may look like Escape; use the controller’s `release()` for application exits. Platform events with indistinguishable signals cannot be classified with certainty.

## Controller

`PauseMenu` is the default export of `use-pause-menu/core`, which imports no React code.

- `new PauseMenu(options?)`: Constructs an inert controller. `initialStage` defaults to `first` and can be `return` or `reset` for application-provided history. Set `hasGameData` when saved-game availability is already known.
- `setGameData(present)`: Reports asynchronous saved-game availability. Returning visitors without data see `reset`; genuine first visits remain `first`. Does not replace a gameplay pause/unfocus reason. Storage failures are unknown, not proof that data is absent.
- `start()`: Resolves and records this visit exactly once. Called automatically by `attach()` and the hook effect.
- `attach(element)`: Observes the element’s owner document and window, synchronizes an existing lock and returns an idempotent cleanup. One active attachment per controller. Attaching a new target disconnects the previous one; stale cleanup cannot detach a newer attachment.
- `ref`: A stable React 19 callback ref returning attachment-owned cleanup. Use either this or `attach()`, not both for the same canvas.
- `enter(options?)`: Requests pointer lock immediately, before its first await. Call directly from a user gesture. Forwards `PointerLockOptions`, including `unadjustedMovement`. Returns a promise; unattached targets and rejected requests reject without changing the stage. The game owns error presentation and readiness checks.
- `release(reason = 'unfocus')`: Requests release only if this controller’s target owns the lock. `release('pause')` supports explicit pause buttons. Does not release other canvases.
- `getSnapshot()`: Returns the same frozen `{stage, locked}` object until either value changes.
- `subscribe(listener)`: Notifies after changes and returns cleanup. Methods are bound, so they can be passed directly to React or another external-store adapter.
- `getServerSnapshot()`: Returns the stable construction-time snapshot for hydration.

Disconnecting removes browser listeners and releases an owned lock. A playing session becomes `unfocus`; disconnecting an unopened menu does not turn it into a pause menu. Pending requests that finish after detachment cannot leave an orphaned owned lock. The controller retains its visit history and subscriptions across attachment changes; unsubscribe separately when a consumer goes away.

## Visits and storage

```ts
const menu = new PauseMenu({
  storageKey: 'my-game:visited',
  storage: () => sessionStorage,
})
```

Omit `storageKey` for memory-only operation. Otherwise the default storage is `localStorage`; supply a lazy `storage` resolver for `sessionStorage`, a test double or another synchronous `getItem`/`setItem` store. The marker is the string `true`. Each game should use a distinct key. Storage read, write and access errors never prevent playing. A failed write does not erase an already recognized returning visit. New-game actions do not clear visit history.

The package does not inspect saved worlds or account identities. After reading persistence, call `menu.setGameData(saved !== null)`. Count any independent player checkpoints as game data too. Keep the visit marker separate from game saves so deleting a save does not turn a returning visitor into a first-time visitor.

## React Three Fiber

Attach to the actual canvas from within your scene without adding a Fiber dependency to this package:

```tsx
import {useEffect} from 'react'
import {useThree} from '@react-three/fiber'

import {menu} from './menu.ts'

export default function PauseMenuTarget() {
  const renderer = useThree(state => state.renderer)
  useEffect(() => menu.attach(renderer.domElement), [renderer])
  return null
}
```

Fiber’s `/legacy` WebGL entry exposes the same `renderer.domElement`. Keep the DOM menu outside Canvas and read the same controller with `usePauseMenu(menu)`. PointerLockControls may still own camera rotation; the controller observes locks requested externally too. Your game still owns movement cleanup, room names, minimaps, audio and what New game resets.

## Tests

Run `bun run test` from this package. Tests use deterministic event targets, not a browser or simulated desktop input. Coverage includes visits, blocked storage, SSR, stable subscriptions, Escape inference, Windows-key-style blur, visibility changes, lock transfers, failed and late requests, target replacement and idempotent cleanup.
