# use-graphics-mode

A small, controlled React API for a graphics mode. State is a boolean named `isHeavy`: `true` selects heavy rendering and `false` selects fast rendering. An optional `isCinematic` boolean marks heavy rendering as meant for non-realtime output, like recorded films, which can afford far more per frame. Consumers never need to compare or toggle enum values.

No renderer, global store, hardware detection, URL library or persistence dependency. The application owns the booleans and defines its rendering budgets.

## Usage

```tsx
import {useState} from 'react'
import useGraphicsMode, {GraphicsModeProvider, useGraphicsModeValue, useSetGraphicsMode} from 'use-graphics-mode'

const heavyBudget = {shadows: true, particles: 1000}
const fastBudget = {shadows: false, particles: 100}

function GraphicsButton() {
  const isHeavy = useGraphicsMode()
  const setIsHeavy = useSetGraphicsMode()
  return <button onClick={() => setIsHeavy(!isHeavy)}>{useGraphicsMode.getName(isHeavy)}</button>
}

function SceneBudget() {
  const budget = useGraphicsModeValue(isHeavy => isHeavy ? heavyBudget : fastBudget)
  return <output>{budget.particles} particles</output>
}

function App() {
  const [isHeavy, setIsHeavy] = useState(true)
  return <GraphicsModeProvider isHeavy={isHeavy} onChange={setIsHeavy}>
    <GraphicsButton/>
    <SceneBudget/>
  </GraphicsModeProvider>
}
```

## API

- `GraphicsModeProvider`: requires `isHeavy: boolean`, `onChange(isHeavy: boolean)` and `children`, and takes an optional `isCinematic: boolean` (default `false`). It neither mirrors nor mutates the supplied state. `isCinematic` only takes effect while `isHeavy` is `true`, so cinematic graphics are always heavy and an owner can keep the flag across fast/heavy toggles.
- `useGraphicsMode(): boolean`: reads the nearest provider’s `isHeavy`, which is `true` for cinematic graphics too.
- `useCinematicGraphics(): boolean`: reads whether the nearest provider’s heavy graphics are cinematic.
- `useGraphicsMode.getName(isHeavy: boolean, isCinematic = false)`: returns `'cinematic'`, `'heavy'` or `'fast'`. This pure formatter works outside React and does not require a provider.
- `useSetGraphicsMode()`: returns the nearest provider’s original boolean change callback.
- `useGraphicsModeValue(select)`: calls `select(isHeavy, isCinematic)`, preserving the selected value’s identity and inferred type without enum-keyed records. A selector that only takes `isHeavy` keeps working.

Hooks throw clearly outside a provider. `false` is a valid setting, not a missing provider. Nested providers isolate their booleans and callbacks. Separate value and callback contexts avoid subscribing read-only consumers to callback changes. There is no module-owned mutable state, so independent roots and server renders cannot leak preferences into each other.

## Renderer integration

Place the provider above both the settings UI and the scene. Three Fiber bridges React context into its Canvas. Do not key the Canvas, physics world or gameplay subtree by `isHeavy`: changing a budget should not reset the game.

Selectors run during rendering and must be pure. Select existing values or resource factories, then instantiate selected factories inside lifecycle-aware hooks. Dispose owned GPU resources on replacement or unmount. Renderer constructor-only options cannot be made reactive by this package; keep them stable or implement an explicit renderer transition.

URL parsing, persistence, defaults, labels, frame budgets and material art direction belong to the consumer.

## Development

Run `bun test` in this package. The repository’s normal root checks also cover the workspace package.
