# knot-materials

Procedural Three.js/WebGPU knot materials and the metadata, geometry, loading, exhibition layout, and asset-generation tools used by Knottingham.

## Structure

```text
src/
  entries/
    benthic_beacon/
      data.ts
      Material.ts
    ferrothorn/
      data.ts
      Material.ts
    index.ts
  candidates/
    gpt_astra/
      data.ts
      symbol.svg
      lib/
    index.ts
  lib/                    # Shared shader primitives and the material base class
  main.ts                 # Metadata-only catalogue
  types.ts
  rarities.ts             # Exhaustive, centrally curated rarity map
  knotMaterials/
    base/KnotMaterials.ts
    DirectKnotMaterials.ts
  geometry.ts
  StudioEnvironment.ts
scripts/
  makePrompt.ts
  lib/
```

Every knot lives directly in `src/entries/<id>`. Candidate folders contain attribution, shared candidate-specific utilities, and candidate/model assets—not nested knot entries. Shared shader functions live in `src/lib`; a helper used only by one candidate lives in that candidate's `lib`; a helper used only by one knot lives directly in its `Material.ts`. Materials import the narrow helper files they need. `src/lib/index.ts` also provides a barrel.

`main.ts` and the metadata barrels never import shaders. The application can inspect the catalogue without evaluating any material constructors. `materials.ts` is the Vite-specific lazy loader, which gives every entry's `Material.ts` a chunk of its own; scenes pass it to `DirectKnotMaterials` and `RuntimeKnotIconRenderer`, so they only download the shaders of the knots they show.

## Metadata and identity

```ts
import type {KnotData} from '../../types.ts'

export default {
  id: 'benthic_beacon',
  candidateId: 'gpt_astra',
  title: 'Benthic Beacon',
  flavorText: 'One small beacon keeps watch at the bottom of the world.',
  placeholder: {
    color: '#4de3ff',
    shading: 'glass',
  },
  author: {
    model: {
      title: 'The actual inference model title',
    },
  },
} as const satisfies KnotData
```

IDs are globally unique snake_case strings. A candidate is a grouping concept, not necessarily a single model. Keep exact model provenance in `author.model`: required `title`, optional `slug` and `effortLevel`. Use `harness: 'none'` for direct API inference, the actual harness name when known, and omit it when the provenance is unknown.

`KnotId` is derived from the named exports of `src/entries/index.ts`; `KnotCandidateId` is derived from the candidate metadata barrel. The registry rejects invalid IDs, cross-candidate duplicate IDs, missing rarities, mismatched candidate attribution, and invalid displacement bounds. Display titles are independent of IDs.

`KnotEntry.rarity` is computed from the central rarity map, not stored in each `data.ts`.

## Rarity and exhibition selection

`rarities.ts` exports `unknown = 0`, `common = 1`, `rare = 2`, `prime = 3`, `ethereal = 4` and `special = 5`. Its `Record<KnotId, Rarity>` requires a rating for every entry. Unrated entries are `unknown` and display no stars.

`special` is a five-star tier outside the automatic exhibition. Special entries are never shown unless intentionally requested, either by naming them in `?knot_id=` or by a `?rarity_filter=` that includes `special` (or `5`). They are also excluded from every candidate score, like `unknown` entries, so they neither lift nor lower their candidate's row order. `knotty_prince`, `great_cat_emergence` and `felis_major_menagerie` are special.

Knottingham displays up to four non-special entries per candidate and up to eight candidates by default. Entry selection prioritizes higher rarity, with ID as a deterministic tie-breaker. The selected row then runs from lower to higher rarity, putting its rarer entries at the far end. `?shots=N` changes the per-candidate entry cap; `?candidate=id,id` filters candidate rows; `?model=id` filters entries to one model before the shot cap, using the final segment of its provider slug (or a slugified model title when no provider slug exists); `?candidate_limit=N` caps the filtered, ordered candidate list. `?knot_id=id,id` switches to an exact knot whitelist: every listed knot is shown, grouped into its candidate row, without the normal shot or candidate caps. `?candidate_order=score|name` controls row order: `score` (the default) equally blends the average rarity of the candidate's six highest-rated known knots with the average rarity of all its known knots, excluding `unknown` and `special` entries; candidates with fewer than six rated knots use all rated knots for both averages, and candidates with no rated knots fall back to a score of 1.1. `name` sorts by candidate title. `?rarity_filter=` accepts a comma-separated list of rarity integers (`0`–`5`) or names (`unknown`, `common`, `rare`, `prime`, `ethereal`, `special`). The rarity filter is applied before shot and candidate limits and intersects with `knot_id` when both are present. Candidates without any eligible entry after all filters never take a row or a `candidate_limit` slot. Therefore, without candidate-selection parameters, the eight highest-scoring candidates enter the scene.

Knottingham alone recognizes `?rarity=true|false|edit`. The default is `true`. With `false`, both selection under the shot limit and row ordering use canonical ID order, ignoring rarity. Stars remain visible for rated entries; unknown entries have no stars. With `edit`, the initial selection/order still uses rarity, but interacting with a knot's nameplate (the existing E action) cycles 0 (unknown) → 1 → 2 → 3 → 4 → 5 (special) → 0 (unknown). The star strip updates immediately without rebuilding the atlas shader, relocating signs, or reselecting knots mid-edit. Changes remain local to the page session; they do not write source files.

Rarity edits are intentionally session-local and emit no telemetry events. Native WebMCP exposes `dump_knots`, which returns every knot currently present in the world as an array of `{id, name, position, rarity}` records using the live edited rarity values. A curation workflow is therefore: enter `?rarity=edit` (optionally with `rarity_filter`), edit signs, call `dump_knots`, and use that dump to update `src/rarities.ts` explicitly.

When the final selection is exactly one Knot (typically a single `?knot_id=`), the exhibition skips the billboard: the Knot stands in the middle of a plain square room, and its candidate sign hangs between the Knot and the north wall, facing the spawn. Any other selection keeps one billboard per row.

Plate numbers are assigned only after final filtering. Candidate billboard composites are built at runtime from the selected entries' individual icons and current labels, so selection and numbering changes require no asset regeneration.

Displayed knots begin in showcase mode: their rigid bodies are fixed in mid-air and rotate slowly. The first Rapier contact-force event permanently releases that knot into normal dynamic physics. Showcase knots cannot be grabbed; after release they can be picked up, dropped and thrown normally, and temporary fixed-body states while carrying them never restore showcase rotation.

## Material and placeholder contract

Each `Material.ts` default-exports an anonymous class extending `KnotMaterial` from `../../lib/KnotMaterial.ts`. Its synchronous constructor accepts the caller-owned environment `Texture`, calls `super(environment[, intensity])`, and sets `this.name = knotData.id`. Never dispose the supplied environment in an individual material.

For vertex displacement, metadata must declare a conservative maximum distance in meters as `displacement`. Culling and collision geometry expand accordingly, and entries with equal bounds share geometry. The global `knotCurve` and `knotFrame` helpers match the exhibition's torus-knot centerline and tube frame.

`placeholder` sums up how the knot looks: its exact `color` tints its nameplates, and prompt generation spreads its examples across the seven `shading` options, `smooth`, `ghost`, `metal`, `glass`, `stone`, `liquid` and `fabric`. The intended spelling is `smooth`.

Scenes take their knots’ materials from `DirectKnotMaterials`. It has no placeholders and no warmup of its own, since their renderer brings in new materials without stalling, like Slop Gallery’s streaming renderer: the shaders load once the scene subscribes, and its `getSnapshot()` (for `useSyncExternalStore`) lists each knot’s full material once it has arrived, so the scene only mounts a knot then, with its `coreMaterial` on a child mesh if it has one. It extends `KnotMaterials`, which owns the shared `KnotResources`, the environment and the on-demand loading. Full materials are built in every graphics mode, since Knottingham exists to review them.

### Opaque cores under alpha-cut shells

A material may own an optional `coreMaterial` for a solid interior beneath its alpha-cut shell. `createKnotMesh` renders both on the same geometry and transform in preview scenes, and scenes mount the core the same way, on a child mesh of the shell. Core children do not contribute duplicate raycast hits. Disposing the outer `KnotMaterial` also disposes its core, but neither disposes the caller-owned environment. Knotty Prince uses this to retain its original displaced fuzz shell over a closed felt body.

## Generate an inference prompt

From the repository root:

```sh
bun packages/knot-materials/scripts/makePrompt.ts --candidate claude_opus --count 8 --output temp/opus-knots.md
bun packages/knot-materials/scripts/makePrompt.ts --examples 4 --seed another-batch
bun packages/knot-materials/scripts/makePrompt.ts --example-ids ferrothorn,washi_lantern,coralline_crown --output temp/knot-prompt.md
```

The script outputs Markdown to stdout unless `--output` is supplied. It reads the current catalogue, reserves every existing ID, follows the explicit authoring API in `src/lib/index.ts` plus the selected candidate’s `src/candidates/<id>/lib/index.ts`, and includes the complete contents of every statically imported or re-exported local dependency. This includes candidate helpers that none of the examples happen to use. Unexported files, icon-generation utilities, unrelated candidate APIs, and application infrastructure are not included merely because they live in a library folder. Third-party implementation sources and catalogue-derived type-only ID registries are not expanded. Actual `data.ts`/`Material.ts` examples include their own transitive dependencies in a separate example-only section; another candidate’s helper or another knot’s material-local helpers is not an allowed import for a new entry. Default sampling is deterministic for a given seed and favors different candidates and placeholder families. Paths are resolved from the script, so it also works from another working directory.

The generated prompt asks for individual entry files, accurate provenance, placeholder metadata, flavor text, displacement bounds, metadata exports, and `unknown` rarity additions pending curation. It does not call an inference provider, incur inference charges, or write new knot entries itself.

Expose new reusable shader helpers through the appropriate shared or candidate `lib/index.ts` so they are automatically available to future inference prompts.

After accepting a submission, add its metadata export to `src/entries/index.ts` and an initial `unknown` rating to `src/rarities.ts`. Add a candidate metadata module and barrel export only when introducing a genuinely new candidate; register its row in `main.ts` as well. Then typecheck, test, and use the application's voice tooling for its title recording.

## Runtime billboard previews

Knot billboard thumbnails are not persisted as image assets. Knottingham renders the currently selected entries at runtime with one shared detached WebGPU renderer, reads the offscreen render target back into tightly cropped canvases, and composes those canvases into a fixed 3:2 texture for each shared-size billboard. The texture packer chooses a compact row/column layout for the current entry count and centers shorter rows toward the middle. Each billboard face and its timber stand are separate, unattached rigid bodies. The sign simply rests on the stand's feet, while the rear posts and cross-braces form one movable timber stand. The cross makes a rear hit harder to aim, but the unattached sign can still be knocked flat while direct impacts can shift the heavier stand. Both graphics modes screenshot the real knot materials. Fast mode renders them at 320 px without supersampling instead of 640 px with 2× supersampling, and composes the billboard at half resolution.

Candidate signs and labels use each candidate's `symbol.svg` directly. There are therefore no checked-in `icon.jxl` files and no icon-regeneration step when materials, symbols, titles, rarity, selection, or numbering change.

## Render a knot inspection set

From `packages/knot-materials`:

```sh
bun scripts/renderKnot.ts iris_steel
bun scripts/renderKnot.ts iris_steel --category snapshot
bun scripts/renderKnot.ts iris_steel --category animation,video
```

`--category` accepts `snapshot`, `animation`, `video`, or any comma-separated combination. It defaults to `snapshot,animation,video`. `snapshot` covers the angle stills, camera-distance stills, and a widescreen close-up, `animation` covers the animated angle loop, and `video` covers `animation.webm`. Snapshots and the animated angle loop use JPEG XL. Partial runs preserve already-rendered files from unselected categories.

By default the command writes `out/render/<id>` with three 2048 × 2048 angle JXLs (`angle_0.jxl`, `angle_45.jxl`, and `angle_90.jxl`), one 3840 × 2160 `closeup.jxl` at 0.5× distance and a 25° FOV, one 120-frame 512 × 512 `angles.animated.jxl` orbit, two 2048 × 2048 camera-distance JXLs (`distance_near.jxl` at 0.75× and `distance_far.jxl` at 1.8×), and one 960-frame 1024 × 1024 `animation.webm`. The animated JXL uses JPEG XL distance 4.

In Slop Gallery, the repository root’s `bun scripts/renderKnot.ts <knot-id> --scene heavy` or `--scene cinematic` renders the same set from the same camera views, but inside the full game instead of on a transparent background: the knot stands alone in its own Knottingham room (`?knot_id`), held still (`?knot_rotation=false`) and reflecting the gallery’s environment (`?pmrem=slop_gallery`), under Heavy or Cinematic graphics. The renders go to `out/render/<id>-heavy` or `out/render/<id>-cinematic` of this package. Frames render at their output size without the preview’s supersampling, since both graphics modes antialias temporally; stills first settle for 16 frames while the engine clock stands still, and animation frames advance it by exactly their own time step. A Cinematic set takes about 7–25 minutes on a desktop GPU, mostly for the video.

The combined 16-second video is phase-shifted so frame 0 is the least noticeable loop seam: the knot is distant, exactly side-on, and material/shader time starts at zero. The first 0.5 seconds finish the distant hold, 0.5–2.5 seconds return to normal, 2.5–4.5 hold normal, 4.5–6.5 zoom extremely close, 6.5–8.5 hold close, 8.5–10.5 return to normal, 10.5–12.5 hold normal, 12.5–14.5 move out, and 14.5–16 finish the distant hold. The 50° base FOV widens modestly for the near/far distance stills and animated distance extremes so more of the knot remains visible; the close-up instead locks a narrow 25° FOV. Preview rendering uses 2× supersampling plus 4× MSAA, then high-quality downsampling to the final 512 px animated image, 1024 px inspection video, or 2048 px square still. The close-up combines the nearest inspection distance with a 25° FOV, and its native 3840 × 2160 target keeps 4× MSAA without an extra supersampling pass. It completes one full Y-axis turn every two seconds, with eased rotation so broad views linger while side-on views pass faster.

The command owns its Vite server, browser, offscreen renderer, temporary PNG frames and image/video encoding. Candidates only need the single command above.

The private offline server disables HMR so source edits cannot reload its page and invalidate held renderer handles. The interactive development server is unchanged. Already-loaded modules stay stable for that session; this is not a filesystem snapshot, so finish edits before starting a render when reproducibility across newly imported materials matters. A new render session loads the latest source.

WebM encoding explicitly converts display-encoded sRGB PNG bytes to full-range, 8-bit BT.709-matrix YUV 4:2:0. Both filtered frames and the output carry matching full-range, BT.709 primaries/matrix and sRGB transfer metadata. No second gamma transfer is applied. AV1 CRF, preset, frame rate and frame counts are unchanged. Full range is intentional: it passed the browser-decoded color regression more accurately than limited range on the tested Chrome path. JPEG XL encoding is unaffected.

Regenerate affected WebM files from source rather than treating metadata-only retagging as a validated repair. Re-encode retained original PNG frames with `encodeWebm`, or run `bun scripts/renderKnot.ts <knot-id> --category video` from this package to regenerate only the video while preserving the other categories. Preserve historical audit-run artifacts as evidence; regenerate consumer-facing copies rather than silently replacing an audited export.

The browser regressions are opt-in and require `BROWSER` to point to a Chrome executable. From this package, run `KNOT_TEST_BROWSER=1 bun test ./test/webm-color.test.ts` for the PNG-to-WebM browser round trip, and `KNOT_TEST_GPU=1 bun test ./test/preview-isolation.test.ts ./test/preview-output.test.ts` for private-renderer source-edit isolation and GPU readback. The ordinary encoder tests additionally verify stream and decoded-frame color metadata with FFprobe. The source-edit test touches only temporary probe modules, reuses the original renderer handle, and checks that a fresh session sees the edit.

## Narration

Knottingham announcements are generated through `vite-plugin-import-voice-sample` virtual imports rather than checked-in audio files.

`src/announcementAssets.ts` contains one static Iris import for every candidate, model, and knot title in `knotAnnouncements(knotCandidates)`. Each import uses loud delivery and Opus output, while the existing announcement path IDs remain unchanged for `KnotNarration`.

There are no per-knot announcement audio assets in this package. Adding catalogue entries therefore only requires keeping the announcement import inventory in sync (`bun scripts/updateAnnouncements.ts`); runtime playback never initiates speech generation.

A recording may be `undefined`: Slop Gallery only builds them with `VOICE_SAMPLES=true` (see its `vite.config.ts`), and leaves out any its OpenRouter requests fail for. `KnotNarration` then has the browser’s own voice read the title.

## Validation

```sh
bun --cwd packages/knot-materials test
bun run typecheck
bun test --max-concurrency 1 test/unit/knot-exhibition.test.ts
```

Package tests cover metadata and folder parity, unique IDs and flavor text, exhaustive rarities, candidates and their bays, layout, shared resources and raycasts, cellular fields, candidate symbols, the announcement inventory, direct materials, helper ownership, independent material construction, metadata-only bundling, complete prompt source inclusion, deterministic sampling, CLI output from another working directory, and the absence of persisted billboard rasters. Slop Gallery’s `knot-exhibition.test.ts` covers the exhibition in its world.
