# Gallery telemetry

Slop Gallery’s application-specific instrumentation is built directly on `victoria-browser-client`. The reusable `telemethree`, `telemethree-ego` and `telemethree-pause-menu` packages now contain collection/instrumentation only; Victoria queueing, encoding, retry, transport, delivery status and browser lifecycle behavior belong to `victoria-browser-client`.

The browser-only `index.ts` owns the configured `telemetry` singleton and the controller’s `playerTelemetry` source. Import `SlopGalleryTelemetry` directly when constructing an isolated client, such as in unit tests.

```ts
import SlopGalleryTelemetry from '#src/lib/telemetry/SlopGalleryTelemetry.ts'

const telemetry = new SlopGalleryTelemetry({endpoints: {logs: 'https://logs.example.com/insert/jsonline'}})
const disconnect = telemetry.connect(galleryStore, galleryEvents)
// Disconnect on unmount.
```

`useSlopGalleryTelemetry(telemetry, store, events)` pairs gallery subscriptions with React cleanup. A null client disables the hook. Use the reusable Three and ego hooks inside Canvas with the same Victoria client. The hook closes application-owned session/gameplay spans on `pagehide` and reconnects after `pageshow`; `victoria-browser-client` owns the actual bounded keepalive transport, visibility delivery and periodic scheduler.

## Gallery signals

- Five-second gauges: portrait totals and hung/imported/pending/fusing counts, readiness, pointer lock, AI enabled, holding, inspection, and narration activity. `gallery.room.active{room}` emits a bounded one-hot series for every room, including zero for rooms that were left.
- Logs and event counters:
  - attachment, room changes, menu/lock/readiness changes, collection revisions, narration transitions and import/fusion/narration/teleport requests
  - loading: `gallery.loading.progress` every second behind the loading screen, `gallery.loading.finished` once it lifts
  - refused placements: `gallery.placement.refused` with the `reason` from `placementIssues` or `noWall`, `room`, `wall.id` and `placement.in_reach`
  - props: `gallery.prop.grabbed`, `gallery.prop.thrown` and `gallery.prop.dropped` with `prop.id`, `orb.id` for orbs, `room` and the body’s `position.x`, `position.y` and `position.z`: where it was picked up, where it left the hand, or where it went back to; a throw adds the `velocity.x`, `velocity.y` and `velocity.z` it flies off at in m/s, and a drop its `drop.cause`: `released` when let go of, `no_room` when it found no room along the line and went back where it was picked up, also when thrown, and `canceled` when carrying it was canceled, which puts it back too; saying like “Threw Halloween Orb”
  - the Forge’s orb alchemy: `gallery.alchemy.brewed` as the machine takes in an orb, with the `orb.from` and `orb.to` orb IDs and `orb.changed`, saying like “Alchemy turned Transparent Orb into Horror Orb” or “Alchemy kept Halloween Orb unchanged”
  - geofences: `gallery.geofence.entered` and `gallery.geofence.left` with `geofence.id`, the body’s `position.x`, `position.y` and `position.z` and its collision-resolved `velocity.x`, `velocity.y` and `velocity.z` in m/s, which tell the direction it crossed the fence in, all zero right after a teleport, saying like “Entered geofence: Lobby”; every fence of the world counts on its own, so overlapping fences each log and a passage between two rooms leaves one before entering the other, while the fences the player starts in count silently
  - on every attachment, the page’s permalink: `gallery.permalink.read`, whose `_msg` is the JSON `{input, output}`: the search query without its leading `?` and what `read-permalink` reads from it, ordinary parameters as strings merged with the decoded `data` payload; a real `openrouter_key`, and any `data` payload holding one, reads `redacted` in both
  - on every attachment, what the page runs on: `gallery.environment` with the adapter’s `gpu.vendor`, `gpu.architecture`, `gpu.device` and `gpu.description`, `gpu.fallback`, `gpu.timestamp_query` and `gpu.max_texture_dimension_2d`, the `display.pixel_ratio`, `display.color_gamut` and `display.hdr`, the `screen.*` and `viewport.*` width and height in CSS pixels, `host.cpu.cores`, `host.cpu.performance`, `host.memory_gb` and `host.arch`, and `browser.name`, `browser.version`, `browser.mobile`, `os.name` and `os.version` from the user-agent client hints; whatever the browser doesn’t report is left out. It shares the adapter request of `?graphics=auto` (`readAdapter` in `src/lib/rendering/autoGraphics.ts`).
  - a reload for a stale chunk: `src/lib/staleChunks.ts` must not import the telemetry, which loads the world whose chunks may be the stale ones, so right before it reloads, it leaves a report in the tab’s session storage, which the next page logs once on its first attachment as `gallery.chunk.stale_reload` at level `warn`, with the `chunk.path` that failed to load, the `reload.delay_ms` since the reload and the `reload.previous_session_id` of the session it ended
  - errors: `gallery.error.uncaught` and `gallery.error.unhandled_rejection` at level `error` from the `victoria-browser-errors` package, connected as the telemetry singleton is made, so errors while the world still loads count too, with `error.type`, `error.occurrence`, the `code.file.path`, `code.line.number`, `code.column.number` and `code.function.name` of where it was thrown and up to 20 frames as `code.stacktrace`, never the message; the same error logs at most 10 times. React render errors are caught by `RenderBoundary`, which logs “Gallery rendering failed.” with `error.type`.
- Traces: session/startup/gameplay parents, state-change events, label generation, fusions and sparse renderer hitch diagnostics.
  - A fusion merges 2 to 4 ingredients, portraits or items, the first always the hung portrait, into one output portrait. `gallery.fusion` spans one from its portal opening until the director is done with it, with `fusion.id`, `fusion.ingredients` (the count), `fusion.ingredient_kinds` (like `portrait,item`, in their order), `fusion.items` and `fusion.consumable_items` (the prop ids of the items among them, and of those a success uses up, like an orb), `fusion.unchanged` when nothing was contributed to merge the hung portrait with, `mode` (`ai` or `local`), `aspect` and `room`. It ends with `fusion.outcome`: `succeeded` (a new output portrait flipped out), `unchanged` (the hung portrait itself came back out as the output), `canceled` (the player broke it off), `failed` (status error, with `error.type`) or `aborted` (dropped without an outcome, like when its hung portrait went away mid-request or the director was disposed), plus `fusion.outcome_at_s`, `fusion.emerged_at_s` and `fusion.canceled_at_s` in seconds into the fusion.
  - The image model’s request is a `gallery.fusion.generate` span inside it, with the result’s `width` and `height`.
  - The player jumping into the portal is a `gallery.fusion.cancellation_triggered` span event with `cancellation.trigger` `portal_jump` and `fusion.elapsed_s`.
- Ego measurements record every rendered foreground frame: `ego.position.x/y/z` are the controller’s physical feet position in meters, `ego.velocity.x/y/z` its collision-corrected velocity in meters per second and `ego.aim.yaw`/`ego.aim.pitch` the viewing rotation in radians. The camera provides aim, not locomotion. Cheap camera origin/direction reads supply rotation each frame; the expensive `AimInspector` raycast and its hit/distance/point metrics still run once per second. Each frame’s metric components share one capture timestamp, with millisecond precision in VictoriaMetrics. Positions and angles are numeric values, never labels.

Automatic telemetry selects only counts, flags, state names and numeric player/aim measurements. Explicit X-key dumps (only with `?development`) additionally include scene object names and scalar metadata as described below. Those automatic samples do not serialize keys, artwork sources, titles, descriptions, prompts, event payloads or exception messages. Every world reports as `service.name=slop.gallery` in `service.namespace=web`; the `world` resource attribute (`gallery`, `knottingham` or `sandbox`) tells them apart and becomes a metric label, a log field and `resource_attr:world` in traces. `victoria-browser-client` supplies the 15-character `service.instance.id` used to distinguish concurrent clients and counter lifetimes. New sessions create new series; retention/cardinality policy belongs to the deployment.

## Victoria delivery

Telemetry is opt-in in every build. Without `?telemetry` (or `?telemetry=true`), the `telemetry` singleton is `null` and nothing is collected or sent. `?ai=false` disables AI, not telemetry.

The browser sends straight to Victoria. There is no relay, Vite proxy or default endpoint. Pass a full ingestion URL per signal; a signal without one is not sent:

| Signal | URL parameter | Format | Example |
| --- | --- | --- | --- |
| logs | `logs_ingestion_endpoint` | VictoriaLogs JSON lines | `https://logs.example.com/insert/jsonline?_stream_fields=service.name` |
| metrics | `metrics_ingestion_endpoint` | VictoriaMetrics JSON import | `https://metrics.example.com/api/v1/import` |
| traces | `traces_ingestion_endpoint` | OTLP/HTTP JSON | `https://traces.example.com/insert/opentelemetry/v1/traces` |

The endpoint parameters only apply together with `?telemetry`. Remember to URL-encode them. The ingestion hosts must accept unauthenticated POSTs and answer CORS preflights for the gallery origin. Native logs use `_msg`, `level` and flattened resource/attribute fields instead of OTLP’s `severity_text`. VictoriaLogs rejects OTLP JSON, so logs always use JSON lines. Metrics retain dotted names, while resource and measurement attributes become VictoriaMetrics labels. The Victoria client bounds request/item sizes, refuses redirects, omits browser credentials and uses keepalive only for requests within its browser size limit.

Native WebMCP `get_telemetry` returns the session ID plus `collectionStatus()` and `status()` from `victoria-browser-client`. This is read-only. Delivery is bounded and best-effort; HTTP acceptance is not a durable end-to-end storage guarantee.

## Queries

MetricsQL:

```text
{__name__="three.fps","service.name"="slop.gallery"}
{__name__="three.frame.duration.p99","service.name"="slop.gallery"}
{__name__="ego.speed","service.name"="slop.gallery"}
```

VictoriaLogs LogsQL:

```text
_time:10m "service.name":="slop.gallery"
```

VictoriaTraces’ underlying LogsQL fields use a resource prefix:

```text
_time:10m "resource_attr:service.name":="slop.gallery"
```

## Performance capture workflow

Performance reports carry `room`, `locked`, `graphics.profile` and the effective shadows/postprocessing/floor-reflections/noise-textures flags, plus `graphics.anti_aliasing` (`traa` or `none`). Dimensions and DPR are metric values, not labels. Room, lock, graphics and output changes split the window; use the new workload distribution names, not retained unsuffixed final-frame gauges.

The gallery renderer opts into timestamp queries only when telemetry is enabled. It traces actual `init()` and `compileAsync()` calls. The load-time pipeline warmup (see the rendering readme) runs as ordinary frames behind the loading screen, not as `compileAsync()`.

`gallery.session` parents startup and pointer-lock gameplay intervals. Startup ends on readiness; unlock ends gameplay. State changes are bounded span events with the existing correlated logs/counters, not independent traces. AI/fusion operations inherit the active context at their start and retain it across async boundaries. Parent spans export when ended, so an ongoing session/gameplay parent may not yet be visible. On `pagehide`, the app ends those open gallery spans; from that event until `pageshow`, the Victoria browser client dispatches every admitted record right away as keepalive requests, so they leave a closing page even behind a request still in flight. VictoriaTraces only shows spans about 30 s after they arrive (`-search.latencyOffset`). Event overflow is explicit; logs continue independently.

The Victoria client schedules batched delivery every second while renderer statistics still report every five seconds. Per-frame ego samples retain their individual timestamps instead of being averaged or reduced to the last frame. The in-memory outbox allows 32 768 items per signal (with the existing 16 mb byte limit) to accommodate high-refresh frame sampling between deliveries. Batches allow up to 4096 items and 256 kb so native metrics can compact repeated series into timestamp/value arrays instead of sending many tiny requests. Requests above the client’s 16 kb keepalive limit use ordinary delivery, so a closing page may lose its final batch. Delivery remains bounded and best-effort. Use `get_telemetry` to inspect collection limits, pending records, rejection/drop counts and delivery failures before interpreting missing GPU/trace data.

### Manual comparison

1. Reload with `?development&telemetry&graphics=heavy`.
2. Enter and walk a repeatable route through the problematic rooms, including turns toward shadow-heavy interiors. Pause briefly in each room.
3. Note any long freeze and its approximate time.
4. Repeat with `graphics=fast`. Do not compare different rooms, pointer-lock states or output sizes as if only the profile changed.
5. Compare aligned workload distributions, sampled GPU/wall timing and hitch details. A second run with `telemetry=false` can assess observer overhead, but exports are intentionally absent there.

Example MetricsQL for the proportion of locked frames slower than 33.33 milliseconds, grouped by room/profile:

```text
100 *
sum by (room, graphics.profile) (
  increase({__name__="three.frames.slow","service.name"="slop.gallery",locked="true","threshold.ms"="33.33"}[10m])
)
/
(sum by (room, graphics.profile) (
  increase({__name__="three.frames","service.name"="slop.gallery",locked="true"}[10m])
) > 0)
```

Thresholds overlap; never sum different thresholds together. Counter increases need at least two exported samples; use traces to inspect a one-off short interval.

```text
{__name__=~"three.gpu.render.(duration|frame_duration)","service.name"="slop.gallery"}
{__name__="three.render.passes.mean","service.name"="slop.gallery"}
{__name__=~"three.memory.*bytes","service.name"="slop.gallery"}
```

Hitch spans in VictoriaTraces:

```text
`resource_attr:service.name`:=slop.gallery name:=three.frame.hitch _time:30m
| sort by (_time desc)
| limit 50
```

Use the returned trace ID for the gameplay/startup/operation context. Detailed pass UIDs and script URLs exist only in traces, never metric labels. GPU samples are sparse; missing GPU time is unknown, not evidence of a CPU-only stall.

## Player dumps and WebMCP

With `?development` (or `?development=true`), press X while playing to capture a detached diagnostic snapshot. Without that flag, X does nothing: the player gets no dump handler, so ego-player ignores the key and never creates its diagnostic raycaster. The app prints the snapshot with `console.dir`, copies it to the clipboard in Clank format (via `stringify-clank`) as `<details><summary>{world title} at {local DD MMM YYYY HH:mm}</summary><dump id=… date="…">…</dump></details>`, with the page’s URL host name as `host` right before `query`. The clipboard snapshot carries the CSS viewport size in `context.viewport` next to the camera’s fov and aspect, plus a `query` map of every query parameter that differs from its default (known parameters normalized, unknown ones as given) and emits an `ego.dump` log, followed by one `ego.dump.hit` log per visible mesh/instance hit. Join records by `dump.id`; `hit.index` preserves near-to-far order. The summary includes the closest hit as `hit`, expected hit count, player state, camera pose/FOV, timestamp, world, room and session ID. The dump format (rounded, no matrices or UUIDs) is described in `packages/ego-player/readme.md`; `context` leaves out `active`, `held`, `inspecting` and `sessionId` while they are unset. Its `camera.position` with `yaw`/`pitch` is the pose a camera bookmark needs, minus the eye height above `player.position`. Per-hit records keep long sightlines from overflowing a single telemetry record. Normal queue/delivery limits still apply; compare the expected hit count when reconstructing a dump. No dump is sent when telemetry is disabled. With `?dump_screenshot` (or `?dump_screenshot=true`), every dump also captures the current frame through the WebGPU capture bridge and downloads it as lossless `<world>-<dump.id>.webp`, independent of telemetry. Without that flag, X downloads nothing.

Query VictoriaLogs with `service.name:=slop.gallery event.name:=ego.dump _time:1h | sort by(_time desc)` (add `world:=knottingham` or similar to narrow it to one world). World-space `hit.point` and `hit.normal` in the JSON message provide placement coordinates. Use `dump.id` to retrieve all hit records for a snapshot.

Native WebMCP exposes read-only `get_aim`, `get_telemetry`, `dump_knots`, `dump_portrait_slots`, `dump_portraits`, `analyze_world` and `get_loading_items` plus `download_frame`, `throw_prop`, `spawn_orb`, `hang_work`, `end_warmup` and `set_wireframe` through `document.modelContext`. The first two inspect player aim and telemetry delivery. `dump_knots` returns every Knot of the current world: Knottingham’s selection with live session rarity edits, or the gallery’s showcased ones, like the one on the Salon’s pedestal, while their rooms are mounted. `dump_portrait_slots` returns the world’s portrait slots, including the edits made on this page under `?edit_portrait_slots`, and `dump_portraits` every work of the collection where it is now, with its frame’s middle and rotation, which follows a work through the air, like the result of a fusion. `download_frame` renders the current view through the WebGPU capture bridge and downloads it as lossless `<name>.webp` (or `.png` with `format: 'png'`), the same way X dumps save their screenshot under `?dump_screenshot`, though the tool does not need that flag. It returns the file name, size and byte count plus `dump`, the X dump snapshot (with `context` and `query`) taken right before the frame, or null without a player. The default name is `<world>-<dump id>`, matching X screenshots. Unlike X, the tool does not log, copy or play a sound. `analyze_world` sorts the scene’s meshes and lights into the rooms whose fences hold them (see `scripts/analyzeWorld.ts`), `get_loading_items` lists what is still loading, which captures wait for, `throw_prop` throws a prop, like an orb, the way the player does, at a portrait, through a point or with a velocity of its own, so a hung portrait it strikes opens a fusion (film recipes run it through their `tools` keyframes), `spawn_orb` brings an orb of any kind into the world, even one the game has none of yet, like the Horror Orb, `hang_work` hangs an image in a portrait slot as an imported work in place of what hangs there (`scripts/renderFusion.ts` films fusions through these), `end_warmup` ends the warmup of headless captures and `set_wireframe` drives the wireframe flood of headless renders. The tools do not move the player, acquire focus or enable telemetry. Their registrations are removed on unmount/HMR using AbortSignals.

Pause-menu events use `telemethree-pause-menu`: discrete `pause_menu.attached`, `pause_menu.changed` and `pause_menu.detached` logs include the current/previous stage and lock state. They share the app’s Victoria client and session identity.
