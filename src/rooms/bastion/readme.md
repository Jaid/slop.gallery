# Bastion geometry

The Bastion keeps one geometry configuration across Fast, Heavy and Cinematic. Graphics settings change lighting and rendering, not collision surfaces, the golf route or floor-height queries. Do not tie a Rapier mesh to a graphics-mode hook.

## Tessellation

- **Vaults:** `RouteVaultGeometry` keeps the route’s outline creases, but simplifies each intervening run against three cross-section controls with a 3 mm longitudinal control-point tolerance. Floor-ramp knots need not all become ceiling rows. The half arch has 21 segments; the odd count leaves a flat crown facet for lantern canopies. Ribs use the same profile.
- **Paving:** level sections span the full width. Troughs retain their center and original shoulder bevels, not redundant columns on each planar slope. Inlets keep their joining floor’s knots. The golf outlet has its own authoritative grid, shared by the mesh and triangle-interpolated floor queries.
- **Curved skirting:** `ProfiledBaseboardGeometry` sweeps the complete stepped section through floor-contact knots and bend stations. Its faces are strips with hard section edges. This avoids triangulating a long, concave band into fans, unioning two such bands and slicing the result into thousands of tiny triangles. Openings still cut the finished solid. Plain wall/cornice boxes are not resliced merely because the skirting has a floor profile.
- **Golf landing:** `BastionLanding` extends `FloorHollow`. Its bowl uses a 12 cm grid and shares every seam knot with the outlet, whose rows are at most 24 cm apart. The 24 cm-high return threshold replaces a piece of the hallway slab and is part of the same rendered mesh and welded collider. Its east side is ramped; the player’s normal autostep crosses the west side. It sits between lanterns to preserve headroom.

The bowl’s relief is 25 cm over a 4 m approach, in addition to the landing’s existing crossfall. The threshold keeps eastbound rebounds out of the level hallway; a shallow bowl alone depended too much on the previous baseboards’ triangulation. The gate’s 60 × 50 cm mouse hole is unchanged. No invisible bumper, orb steering force or graphics-dependent physics is used.

## Measured reduction

Production `analyze_world`, gallery seed 1, before/after issue #225. Baseline measured in Fast; the final counts are identical in Fast, Heavy and Cinematic:

| Meshes attributed to the Bastion | Before | After |
|---|---:|---:|
| Walls and trim | 163 786 | 63 942 |
| Barrel vaults | 105 240 | 37 753 |
| Vault ribs | 24 660 | 13 948 |
| Routed paving | 59 138 | 18 247 |
| Golf landing, including the new threshold | 10 854 | 2808 |
| **All meshes attributed to the room** | **420 231** | **195 771** |

That is **53.4% fewer model triangles**. These are geometry counts, not screen-visible triangles, shadow-pass counts or a frame-rate benchmark. The total also includes unchanged props and fixtures attributed to the room by spatial analysis. Other rooms’ counts are unchanged.

## Regression checks

- `test/unit/bastion-geometry-budget.test.ts`: budgets for the walls, sweeps and golf landing.
- `test/unit/profiled-baseboard.test.ts`: closed outward winding, hard edges, profile interpolation and discontinuities.
- `test/unit/golf-return-sill.test.ts`: mesh/query agreement, removal of the underlying slab, six walking crossings without jumping and nine sideways misses returning through the hatch.
- `test/unit/golf-gate-floor.test.ts` and `lodge-spur-floor.test.ts`: seam heights, normals, baseboard contact, slab thickness and rolling/walking across the joins.
- `test/unit/forge-alchemy.test.ts`: 100 scattered cannon shots through the complete cistern → hairpin → gate → crater route, requiring at least 95% through the hatch within 60 s. Some lateral rebounds take longer to work their way through the narrow opening; the side-miss tests allow 120 s.
- `bun run test:live:bastion`: production-browser keyboard crossings in both directions and three lanes, in Fast, Heavy and Cinematic.
- The armor must still stand, right itself after nudges and sleep. A knocked-off helmet that has left the spur may continue rolling slowly on the link’s downhill floor; the test checks that specific case rather than requiring every detached helmet to sleep within 15 s.

For visual/count comparisons, build first and use `bun scripts/analyzeWorld.ts --target dist --room bastion --graphics fast --json <file>` and `bun scripts/snap.ts --target dist --bookmark bastion-overview`. The analysis script supports `--base <file> --format markdown`. Include the gate from both sides when changing its drainage geometry.
