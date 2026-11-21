# World overlay

The overlay draws world-space and viewport markings over both the finished canvas and captures. Drawings are page-local. They survive the caller disconnecting and disappear on reload. Hiding the scene UI hides the pass; an empty overlay draws nothing.

```ts
import overlay from '#src/lib/overlay/index.ts'

const layer = overlay.addLayer({id: 'bounds', priority: 20, color: '#80ff00'})
const ring = overlay.addCircle([0, 1.5, -3], 0.75, {layer, normal: [0, 0, 1]})
ring.remove() // or clear the whole layer with overlay.clearLayer(layer)
```

## Layers

`addLayer(options)` creates a layer and returns its ID. Only `id` is required. IDs must be nonblank and unique. Drawings without a `layer` use `default`; referencing an unknown ID is an error.

| Option | When omitted |
| --- | --- |
| `obstructedOpacityFactor` | `1`. Multiply the existing stroke opacity by this factor (0–1) only behind a depth-writing world mesh. `0` hides the obstructed portion; `0.5` halves its opacity. Independent of layer priority. |
| `priority` | `0`. Higher layers draw over lower ones, regardless of drawing order. |
| `color` | White (`#ffffff`). Accepts `#rgb` or `#rrggbb`. |
| `lineWidth` | Follows the live **G → World overlay** width, initially `?line_width` or `100`. Range 1–800; the width in pixels is `(lineWidth / 100) * Math.sqrt(viewWidth * viewHeight / (1920 * 1080))` using the active viewport’s physical pixel dimensions. |
| `lineStyle` | Follows the live overlay style, initially `?line_style` or `barycentric`. Choose `aliased` for hard edges. |
| `fade` | `false` (no distance fade). Pass an object to enable it; omitted fields use `{start: 16, end: 100, heightWeight: 5, power: 10}`. Per pixel, scale the vertical camera offset by `heightWeight`, then fade between `start` and `end` meters with a reversed smoothstep raised to `power`. Pass `false` for no distance fade. |

Both fence layers explicitly enable the distance fade. Fences use `fences` (blue, priority 10) and `touching-fences` (red, priority 11). Crossing a fence moves its drawing between layers without rebuilding its geometry. `?show_portrait_slots` uses `portrait-slots` with `obstructedOpacityFactor: 0.2`: both the frame and its placard keep 20% of their original fill and border opacity behind depth-writing meshes. The editor uses the same layer for its placement preview.

`?show_lamps` (also `?edit_lamps`) and `?show_ambience_emitters` draw filled, dark-rimmed dots on `lamps` and `ambience-emitters`, one instanced batch per layer. Lamps casting shadows have square markers, including point lights currently borrowing a shadow slot. In the lamp editor each selected light with a finite range also shows a sphere outline at its cutoff distance. `?show_sloperator_sightings` outlines each possible Sloperator sight in the current world’s reach on `sloperator-sightings`, even before he appears. Each box fits his initial seated or standing pose at that sight and follows his placement when he spawns. These diagnostics are visible through walls and do not fade with distance.

`clearLayer(id)` removes the drawings currently on that layer. `clearDrawings()` clears all layers, including fences. Both return the number removed, release the drawings’ GPU resources and keep the layer definitions for reuse. A cleared handle is inert. Clearing fence drawings does not change the selection: toggle `show_fence` off and on to rebuild them.

## Drawing primitives

- `addLine(from, to, style?)`, `addTriangle(a, b, c, style?)` and `addBox(min, max, style?)` draw a segment, a triangle’s perimeter and an axis-aligned box’s edges.
- `addPoint(position, options?)` draws a three-axis cross with an optional `radius` (default 0.1 m).
- `addCircle(center, radius, options?)` draws a horizontal ring by default. Pass a plane `normal` or a segment count (default 64).
- `addViewportRectangle(x, y, width, height, style?)` outlines a rectangle fixed to the active viewport. Coordinates start at the top left, increase rightward and downward and are fractions of viewport width and height (also in captures). Edges outside the viewport are clipped. It follows layer order and stroke styling but ignores world depth and distance fade.
- `addCameraFacingRectangle(center, width, height, style?)` outlines a world-space rectangle centered at `center`. Its full width and height are in meters, parallel to the image plane of the camera rendering it. It follows the layer’s distance and obstruction settings like other world drawings.
- `addSphere(center, radius, options?)` marks a world-space center with a circular outline that stays round from every camera angle. Its radius is in meters, so it looks smaller from farther away. It accepts the same style and segment count as a circle. Its handle also supports `setBounds(center, radius)` to move or resize it without rebuilding the ring.
- `addSegments(positions, style?)` batches endpoint pairs from a `Float32Array` into one draw call. Treat the buffer as immutable.

All primitives accept `layer`, a `color` override, `name` and a within-layer `renderOrder`. The returned handle supports `remove()` and `setStyle({layer, color, name, renderOrder})` with any subset of those fields. Moving an uncolored drawing adopts the destination layer’s color; an explicit color travels with the drawing.

## WebMCP

| Tool | Example input | Result |
| --- | --- | --- |
| `add_layer` | `{"id":"bounds","color":"#80ff00","priority":20,"lineWidth":200,"fade":{"end":80}}` | `{id}` |
| `add_drawing` | `{"drawing":{"type":"sphere","layer":"bounds","center":[0,1.5,-3],"radius":0.75}}` | `{id, drawing}` |
| `add_drawing` | `{"drawing":{"type":"viewport_rectangle","x":0.1,"y":0.1,"width":0.8,"height":0.8}}` | `{id, drawing}` |
| `add_drawing` | `{"drawing":{"type":"camera_facing_rectangle","center":[0,2,-4],"width":2,"height":1}}` | `{id, drawing}` |
| `clear_layer` | `{"id":"bounds"}` | `{removed}` |
| `clear_drawings` | `{}` | `{removed}` |
