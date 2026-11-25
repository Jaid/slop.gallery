# Portrait frame rendering costs

Measured 2026-11-25 at `690b9035` with `scripts/benchmarkDelta.ts`. All 56 portrait frames were measured in both views: 448 frame comparisons and 40 hidden/hidden controls, spanning 146 616 timed frame intervals.

Across the 56 designs, the median added frame time was **1.95 ms** close up and **0.20 ms** in the overview. The largest close-up cost was **Louis XIV shell** (+9.70 ms, +40.1%); the default Classic gilt added +4.00 ms. From the overview, even the largest measured increase, Impasto, was under 1 ms (+0.95 ms).

Each value is the extra time to render one visible, hung frame compared with the same portrait without the frame mesh. The image, its frame-specific recess, collider, placard, camera and lighting stay in both runs. As a check, the Classic portrait went from four meshes and 18 triangles when hidden to five meshes and 396 triangles when shown, exactly its 378-triangle frame. This is the net cost to the complete scene, including shadows, depth, reflections and anything the mesh occludes.

- **Scene:** Studio, seed 0, one 122.5 × 122.5 cm portrait (Apotheosis of the Rubber Duck), Heavy graphics, 3840 × 2160, uncapped native WebGPU. Animations run normally.
- **Close-up:** eyes at (4, 2, 2.6) m looking level at the painting; 40° vertical field of view. **Overview:** the `studio-overview` bookmark at (4, 2, 7) m, looking down 8°; 65° vertical field of view. For Classic, the image plane projects to about 1440 and 306 pixels high respectively.
- **Sampling:** four Radeon RX 9060 XT cards on Hive, each reserved at the AMD driver’s high performance level. One hidden/shown pair per card for every frame and view, with two cards measuring each order. Fresh Chromium 158 pages; loading, pipeline compilation and 90 settling frames excluded; 4 s sampled per page. The table shows the median of the within-card differences in median animation-frame interval; percentages are computed against the hidden side of each pair.

The frameless scene’s median interval was 23.70 ms close up and 27.50 ms in the overview. In 20 hidden/hidden control pairs per view, the 95th percentile of the absolute single-pair difference was 2.80 ms close up and 0.90 ms in the overview. The five four-card control medians ranged from −0.70 to +1.25 ms and from −0.30 to +0.10 ms, respectively. Those observed ranges are a noise check, not confidence intervals. A small negative delta is not evidence of a speedup.

| Frame ID | Close-up Δ (ms) | Close-up Δ (%) | Overview Δ (ms) | Overview Δ (%) |
|---|---:|---:|---:|---:|
| `louis` | +9.70 | +40.1% | +0.38 | +1.3% |
| `barbizon` | +6.58 | +27.2% | +0.40 | +1.5% |
| `auricular` | +6.40 | +26.7% | +0.40 | +1.4% |
| `bleeding` | +6.25 | +25.3% | +0.45 | +1.6% |
| `velvet` | +6.10 | +25.3% | +0.45 | +1.6% |
| `regolith` | +5.35 | +22.2% | +0.65 | +2.4% |
| `sgraffito` | +4.90 | +20.4% | +0.30 | +1.1% |
| `sevres` | +4.65 | +19.7% | +0.40 | +1.5% |
| `palette` | +4.45 | +18.5% | +0.55 | +2.0% |
| `impasto` | +4.45 | +18.6% | +0.95 | +3.4% |
| `slabs` | +4.35 | +17.9% | +0.40 | +1.5% |
| `classic` | +4.00 | +17.0% | +0.40 | +1.5% |
| `whistler` | +3.85 | +16.2% | +0.25 | +0.9% |
| `leather` | +3.75 | +14.9% | +0.20 | +0.7% |
| `strapwork` | +3.45 | +14.2% | +0.20 | +0.7% |
| `infested` | +3.45 | +14.5% | +0.45 | +1.7% |
| `adam` | +3.15 | +13.3% | +0.30 | +1.1% |
| `meander` | +3.15 | +12.6% | +0.10 | +0.4% |
| `marbled` | +3.00 | +12.5% | +0.30 | +1.1% |
| `perspective` | +3.00 | +12.6% | +0.25 | +0.9% |
| `checker` | +2.85 | +11.8% | +0.25 | +0.9% |
| `gilding` | +2.50 | +10.2% | +0.30 | +1.1% |
| `deco` | +2.45 | +10.4% | +0.15 | +0.5% |
| `coffin` | +2.40 | +9.7% | +0.25 | +0.9% |
| `meteorite` | +2.33 | +9.9% | +0.10 | +0.4% |
| `charred` | +2.30 | +9.5% | +0.15 | +0.6% |
| `coffer` | +2.05 | +8.7% | +0.30 | +1.1% |
| `travertine` | +2.00 | +8.3% | +0.20 | +0.7% |
| `impressionist` | +1.90 | +7.6% | +0.28 | +1.0% |
| `oak` | +1.85 | +7.2% | +0.25 | +0.9% |
| `orbit` | +1.80 | +7.6% | +0.13 | +0.4% |
| `burl` | +1.63 | +6.5% | +0.18 | +0.6% |
| `mission` | +1.63 | +6.7% | +0.20 | +0.7% |
| `casing` | +1.48 | +6.0% | 0.00 | 0.0% |
| `seance` | +1.30 | +5.4% | +0.05 | +0.2% |
| `canvas` | +1.30 | +5.5% | +0.20 | +0.7% |
| `ossuary` | +1.03 | +4.3% | +0.10 | +0.4% |
| `vitrine` | +0.75 | +3.1% | +0.23 | +0.8% |
| `acrylic` | +0.75 | +3.2% | +0.05 | +0.2% |
| `maw` | +0.70 | +2.9% | +0.15 | +0.5% |
| `crate` | +0.60 | +2.5% | +0.20 | +0.7% |
| `brushes` | +0.45 | +2.0% | +0.15 | +0.5% |
| `abyss` | +0.45 | +2.0% | +0.20 | +0.7% |
| `maelstrom` | +0.40 | +1.7% | +0.20 | +0.7% |
| `rift` | +0.25 | +1.1% | +0.20 | +0.7% |
| `flesh` | +0.25 | +1.0% | +0.25 | +0.9% |
| `dichroic` | +0.20 | +0.8% | +0.15 | +0.5% |
| `containment` | 0.00 | 0.0% | +0.10 | +0.4% |
| `lantern` | 0.00 | 0.0% | +0.10 | +0.4% |
| `butcher` | 0.00 | 0.0% | 0.00 | 0.0% |
| `twig` | 0.00 | 0.0% | +0.05 | +0.2% |
| `ripple` | −0.05 | −0.2% | +0.05 | +0.2% |
| `tramp` | −0.05 | −0.2% | +0.10 | +0.4% |
| `float` | −0.15 | −0.6% | +0.10 | +0.4% |
| `kumiko` | −0.20 | −0.8% | +0.05 | +0.2% |
| `evidence` | −0.30 | −1.2% | +0.20 | +0.7% |

To reproduce, apply the [fixture patch](fixture.patch) to a clean checkout of `690b9035`, then run `bun install --frozen-lockfile` and `bun run build`. The patch adds `studio-bench` and makes `?bench_hide_frame` omit just the `portrait-frame` mesh. For example:

```sh
bun scripts/benchmarkDelta.ts '{"parameters":{"frame":"classic","bench_hide_frame":true}}' '{"parameters":{"frame":"classic"}}' --room studio --portraits 1 --seed 0 --spawn studio-bench --fov 40 --height 2160 --graphics heavy --seconds 4 --settle 90 --repeats 4 --format markdown
```

For the overview, use `--spawn studio-overview --fov 65`. Substitute the same frame ID on both sides. The [sortable report](https://portrait-frame-costs.hive.lan/) also includes the [per-frame CSV](https://portrait-frame-costs.hive.lan/results.csv) and [raw benchmark runs](https://portrait-frame-costs.hive.lan/raw.json), with p95 intervals, FPS and geometry counts.
