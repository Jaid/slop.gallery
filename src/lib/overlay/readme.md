# World overlay

Import the shared `overlay` to draw diagnostic outlines in world meters from any component or plain TypeScript module. Drawings do not require `show_fence`. They appear through walls in both the canvas and captures, with the same weighted distance fade. Hiding the scene UI hides the pass; an empty overlay draws nothing.

```ts
import overlay from '#src/lib/overlay/index.ts'

const ring = overlay.addCircle([0, 1.5, -3], 0.75, {color: 'cyan', normal: [0, 0, 1]})
ring.setStyle({color: 'orange'})
ring.remove() // when the producer no longer needs it
```

- `addLine(from, to, style?)`, `addTriangle(a, b, c, style?)` and `addBox(min, max, style?)` draw a segment, a triangle’s perimeter and an axis-aligned box’s edges.
- `addPoint(position, options?)` draws a three-axis cross with an optional `radius` (default 0.1 m).
- `addCircle(center, radius, options?)` draws a horizontal ring by default. Pass a plane `normal` or a segment count (default 64).
- `addSegments(positions, style?)` batches endpoint pairs from a `Float32Array` into one draw call, as geofences do for compound boxes. Treat the buffer as immutable.

Every method accepts `color` (default white), `name` and `renderOrder` in its options and returns an independent handle. Keep its `remove` function for cleanup, e.g. `useLayoutEffect(() => overlay.addLine(a, b).remove, [a, b])`. Line width and smoothing are shared and can be adjusted under **G → World overlay** while drawings exist.

WebMCP’s `add_drawing({drawing})` adds any of the five primitives and returns `{id, drawing}`. A tool drawing remains on the running page until reload. Example: `{"drawing":{"type":"line","from":[0,1,0],"to":[3,1,-2],"color":"#00ffff"}}`.
