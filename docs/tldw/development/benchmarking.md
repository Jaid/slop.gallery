# Comparing rendering performance

`scripts/benchmarkDelta.ts` compares a baseline and a candidate on the same GPU. To compare builds from the same camera, point `BROWSER` at a WebGPU-capable Chromium executable and run:

```sh
bun scripts/benchmarkDelta.ts dist-before dist-after --spawn lobby-overview --height 1080 --format markdown
```

Each setup can also be a JSON object or the path to a `.json` file. `target` selects its build (relative to the file for a saved setup), `parameters` overrides shared gallery options and `tools` lists WebMCP calls to run in order on every fresh page. All three are optional. For instance, to compare antialiasing on and off in the same build:

```sh
bun scripts/benchmarkDelta.ts '{}' '{"parameters":{"anti_aliasing":false}}' --room studio
```

The Bun API takes the same two setups followed by the shared options. To measure the cost of bloom in the Studio, turn it off only for the candidate:

```ts
import benchmarkDelta from './scripts/benchmarkDelta.ts'

const {metrics} = await benchmarkDelta({}, {
  tools: [{name: 'set_world_tuning', input: {values: {pipeline: {bloom: false}}}}],
}, {room: 'studio', spawn: 'studio-overview', development: true})

console.log(metrics.medianFrameMs) // {baseline, candidate, delta, percent}
```

If a preparation call reloads the page, such as changing the Studio’s width, give that call `reload: true` to wait for the new scene before the next call. Loading, preparation and warmup are outside the timed window. By default each run settles for 120 full-size frames and samples for 5 s. Four pairs run, alternating which side goes first.

The JSON report includes the setups and each run’s frame count, drawing-buffer size, median and p95 frame intervals and throughput (frames divided by elapsed time). Within each pair, `delta = candidate − baseline` and `percent = 100 × delta / baseline`. The report takes the median of each, so a difference in GPU speed between pairs doesn’t get mistaken for a change. A negative frame-time delta or positive FPS delta favors the candidate. Compare the individual pairs when a small change is close to run-to-run variation.

## Measurements

- [Rendering cost of all 56 portrait frames](benchmarks/2026-11-25-portrait-frames/readme.md) (2026-11-25): a close-up and a room overview, each against the same painting without its frame mesh.
