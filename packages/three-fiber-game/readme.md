# three-fiber-game

A small, composable game root for native WebGPU React Three Fiber apps. Bring your scene; opt into keyboard controls and Rapier physics; inject providers and dependent content with wrappers.

No gallery state, graphics-quality provider, telemetry, capture service or postprocessing dependency. The application owns those policies. This ESM package exports TypeScript source for modern Bun and bundler consumers, following the repository’s other workspace packages. It is not published yet.

## Usage

```tsx
import Game from 'three-fiber-game'
import {RigidBody} from '@react-three/rapier'

export default function App() {
  return <Game controls={{forward: ['KeyW', 'ArrowUp'], jump: 'Space'}} physics camera={{position: [0, 2, 5]}}>
    <ambientLight intensity={2}/>
    <RigidBody>
      <mesh>
        <boxGeometry/>
        <meshStandardNodeMaterial color="orange"/>
      </mesh>
    </RigidBody>
  </Game>
}
```

The parent container must have a nonzero height. Canvas props such as `camera`, `dpr`, `frameloop`, `onCreated`, events, styles and the canvas `ref` pass through. DPR defaults come from Fiber, not a hidden quality preset. Fiber only applies `shadows` to renderers it builds itself, so `Game` takes `shadows` (`true`, `'basic'`, `'percentage'`, `'variance'` or shadow map fields) and keeps the factory-built renderer’s shadow map in sync; omitting it leaves the shadow map untouched. Physics and keyboard controls are absent unless requested.

## Wrappers

Like `mount-root`, each wrapper prop accepts a component or a readonly array of components. The first entry is outermost: `[A, B]` means `<A><B>{children}</B></A>`. Arrays are never mutated. Omitted wrappers and empty arrays are no-ops.

- `wrapper`: wraps Canvas, inside keyboard controls. Use it for DOM-side providers, boundaries or overlays. It cannot call Fiber scene hooks itself.
- `sceneWrapper`: wraps the world inside Canvas, outside Physics. Use it for scene providers, render effects, telemetry and capture bridges. Its components can call `useThree` and `useFrame` from `@react-three/fiber`.

```tsx
import type {GameWrapperProps} from 'three-fiber-game'
import Game from 'three-fiber-game'

import CaptureBridge from './CaptureBridge.tsx'
import Postprocessing from './Postprocessing.tsx'
import Scene from './Scene.tsx'
import SettingsProvider from './SettingsProvider.tsx'
import TelemetryBridge from './TelemetryBridge.tsx'

function SceneIntegrations({children}: GameWrapperProps) {
  return <>
    <CaptureBridge/>
    <TelemetryBridge/>
    {children}
    <Postprocessing/>
  </>
}

export default function App() {
  return <Game wrapper={[SettingsProvider]} sceneWrapper={SceneIntegrations} physics>
    <Scene/>
  </Game>
}
```

The resulting hierarchy is:

```text
KeyboardControls (when controls has at least one action)
  wrapper[0] → wrapper[1] → …
    Canvas
      sceneWrapper[0] → sceneWrapper[1] → …
        Physics (when enabled)
          children
```

Wrappers receive `children` and must render them to retain the world. Put integrations requiring Rapier context directly around or beside your scene in `Game`’s children, not in `sceneWrapper`. DOM elements belong outside Canvas unless rendered through an appropriate portal.

Define wrapper components at module scope, not inline during render. Read changing settings from context inside stable wrappers. Keep wrapper types, order, physics enablement and keyboard-control presence stable to preserve the mounted scene. An inline wrapper function or a changed wrapper topology can remount its descendants. Changing normal Canvas props or context values does not introduce package-owned keys or reset the physics world. Renderer constructor options are not reactive; changing quality should adjust scene resources and Canvas budgets rather than reconstructing the renderer.

## Controls and physics

Omitting `controls` or passing `{}` or `[]` skips `KeyboardControls`. An action with an empty key list is still a declared action and retains its keyboard state.

`Controls<Actions>` accepts either a record of action names to a key string or readonly key array, or a readonly array of full Drei entries. Entries preserve options such as `up: false`. Normalization copies entries and key arrays, so Drei never receives caller-owned mutable data. `normalizeControls` is also exported for use outside `Game`.

```tsx
import type {Controls} from 'three-fiber-game'
import {useKeyboardControls} from '@react-three/drei/webgpu'

type Actions = 'forward' | 'jump'
const controls = {
  forward: ['KeyW', 'ArrowUp'],
  jump: 'Space',
} as const satisfies Controls<Actions>

function Player() {
  const jumping = useKeyboardControls<Actions>(state => state.jump)
  // Use the selected action in your player logic.
  return null
}
```

`physics` defaults to `false`. `true` enables Rapier with gravity `[0, -9.81, 0]`. An options object passes through all `PhysicsProps` except `children`, including `paused`, `timeStep`, `colliders` and `debug`. An empty object enables physics with Rapier’s defaults. Keep your normal Suspense and error boundaries above the game; physics can suspend while loading WASM.

Props reach the scene only once Fiber commits the Canvas. While the scene still suspends, Fiber’s root Suspense blocks the Canvas itself, but whatever part of the scene has mounted keeps rendering and stepping with the props it got first, `physics` included, sometimes for more than a second. A value that has to take effect right away, like pausing the physics until colliders have loaded, belongs inside the Canvas: leave `physics` off and render Rapier’s `Physics` yourself in a component among `Game`’s children that reads the value there, for example from a store.

## Renderer

The exported `WebgpuRenderer` class constructs Three’s `WebGPUBackend` directly. Adapter/device initialization errors propagate; there is no fallback renderer. Game’s default factory sets `alpha: false` and `antialias: false`, leaving postprocessing and antialiasing policy to the application.

To configure a native renderer, pass a stable `GameRenderer` factory. Fiber owns initialization and the renderer lifecycle. Factories may also return a promise.

```tsx
import type {GameRenderer} from 'three-fiber-game'
import Game, {WebgpuRenderer} from 'three-fiber-game'

const renderer: GameRenderer = options => new WebgpuRenderer({...options, antialias: true})

export default function App() {
  return <Game renderer={renderer}/>
}
```

`WebgpuRendererOptions` excludes compatibility switches, and Canvas’ `gl` and `flat` props are not exposed. Browser rendering requires native WebGPU in a secure context.

## Peer dependencies and bundler setup

Use the peer versions in `package.json`: React 19, Three r187, Fiber 10 (whose root entry renders with WebGPU), Drei 11’s WebGPU entry and Rapier 2.2. All are peer dependencies, including Rapier when physics is disabled, because the package statically imports its component.

Rapier 2.2 still declares Fiber 9 peers and imports bare `@react-three/fiber`, which is the same WebGPU module as Canvas, so no alias is needed. Do not install or bundle separate Fiber copies for Rapier, and do not import the deprecated `@react-three/fiber/webgpu` entry.

## Exports and checks

- Default export: `Game`. Named exports: `normalizeControls` and `WebgpuRenderer`.
- Types: `GameProps`, `GamePhysicsProps`, `GameRenderer`, `Controls`, `ControlBinding`, `GameWrapperProps`, `GameWrapper`, `GameWrappers` and `WebgpuRendererOptions`.

Run `bun run --cwd packages/three-fiber-game test` from the repository root. The tests cover composition, wrapper ordering and context injection, readonly controls, physics options, renderer defaults and native initialization failure. The test preload loads Rapier’s ESM build as Vite does, so it shares Fiber and Three with the app.
