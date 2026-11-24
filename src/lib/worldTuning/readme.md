# World tuning

Values that change how the world shows, live, with `?development`: the panel G shows left of the canvas (`?world_tuning` shows it from the start), the `get_world_tuning` and `set_world_tuning` WebMCP tools and the `gallery.world_tuning.*` telemetry (see the [telemetry readme](../telemetry/readme.md#world-tuning)) all work on the same modules.

- `base/TuningModule.ts`: a module, its values in a zustand store that starts from `initial`, the values the page starts with, and the group boxes the panel shows them in. Consumers follow `module.useValues(selector)` in React or `module.get()` and `module.subscribe()` outside. `set()` records what changed them (`panel`, `key`, `webmcp` or `code`), and switches off with the value a checkbox keeps.
- `controls.ts`: what a group box holds. `tuningControls<Values>()` gives a module typed factories, `range`, `percent`, `select`, `toggle`, `color` and `group`, which check every key against its values. A control may carry `off` (a checkbox that switches it to that value, keeping the one it had), `when` (whether it does anything with the other values), `caption` (a small heading starting a part of its group) and `reloads`; a group `available` (whether the page has it), a `toggle` heading, a `note` and `parameters` to copy.
- `WorldTuning.ts`: the modules a page has, which sets and checks values across them (`set` checks all of them before setting any), resets them, lists what changed and describes every control for the tools. `index.ts` makes the page’s: the view, the modules its world brings along (`World.tuning`), the render pipeline and the overlay.
- `panel.ts` (whether the panel shows), `worldTuningParameter.ts` (`?world_tuning`, light enough for `queryOverrides.ts`) and `tuningBuffer.ts` (the frame from before the latest change, which holding Space over the panel shows).

Modules: `view` (scale, field of view, tone mapping), `lighting` (the gallery’s sun, lamps and fill on top of its lighting preset, which the gallery brings along), `pipeline` (the render pipeline of heavy graphics and the shadows’ lookups, shown in heavy graphics only) and `overlay` (the world overlay’s lines, shown while something is drawn, its store shared with `overlay/tuning.ts`).

## A new module

1. Subclass `TuningModule` with the type of its values, an `id`, a `title`, its `groups` from `tuningControls`, and its initial values for `super()`. Override `isShown()` and `useShown()` with a `hint` for one that only applies at times, and `rebuilds()` for values that build something anew.
2. Export one instance from its file, so consumers import it alone.
3. Add it to the list in `index.ts`, in the order the panel shows it, or, for a module only some worlds have, to their `tuning`; world modules import it then, so it must never import `#src/worlds/current.ts`.
4. Read its values where they apply, only with `?development`.

Every value needs a control or a group heading, which `test/unit/world-tuning.test.ts` checks.
