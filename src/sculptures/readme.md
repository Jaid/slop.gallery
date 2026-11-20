# Sculptures

The Salon displays one sculpture on its permanent 3.2 m × 3.2 m stone socket. The environment seed picks from the ordered registry in `index.ts`, independently of the fountain or other exhibits. A `?sculpture` override previews a specific work; an unknown ID falls back to the seeded pick.

| Work | Design | Preview |
| --- | --- | --- |
| **Block** | An upright block of sawn stone. The default for seed 0. | `?room=salon&sculpture=block` |
| **Counterflow** | A fluted stone ribbon that turns around an open eye, on a chamfered elliptical foot. 24 064 triangles. | `?room=salon&sculpture=counterflow` |

## Contributing a sculpture

1. Create `src/sculptures/<id>/<Name>Sculpture.ts` extending `base/Sculpture.ts`. Give it a stable ID matching its folder, a title, a description, its bounding size as **[width, height, depth] in meters** and its **mass in kilograms**. For solid stone, estimate mass from the volume of stone and its density. Keep this module lightweight: implement `loadModel()` with a dynamic import of `./components/<Name>SculptureModel/index.tsx`, as in `block/BlockSculpture.ts`.
2. Build the model around the **center of its foot at local [0, 0, 0]**, with +Y up. The host supplies the fixed socket, the sculpture’s dynamic rigid body and the V-to-orbit interaction. Include colliders matching the work and distribute the supplied `mass` across them. Use the supplied `material` on every visible mesh. It is the same instance the socket uses; do not clone, mutate or dispose of it. Cast and receive shadows and dispose of geometry the model creates on unmount. Keep the entire visible model, including its foot, within 32 768 triangles.
3. Append the class to `sculptures` in `index.ts` under its ID. No Salon changes are needed. As with fountains, changing the pool can change nonzero seeds’ picks; keep the first entry in place for seed 0.
4. Run `bun test test/unit/sculptures.test.ts` to check the catalog, socket fit, lazy model loaders, and seed/preview selection. With WebGPU Chromium on `BROWSER`, `bun run test:live:sculptures` also verifies that each mounted sculpture stays within the triangle budget and shares the actual socket material. Inspect the work in the Salon using its preview URL.
