# Sculptures

The Salon displays one sculpture on its permanent 3.2 m × 3.2 m stone socket. The environment seed picks from the ordered registry in `index.ts`, independently of the fountain or other exhibits. Seed 0 always shows the first entry: **Block**, an upright block of the same sawn stone as its socket. To preview a specific design, open `?room=salon&sculpture=block` (replace `block` with its ID). An unknown ID falls back to the seeded pick.

## Contributing a sculpture

1. Create `src/sculptures/<id>/<Name>Sculpture.ts` extending `base/Sculpture.ts`. Give it a stable ID matching its folder, a title, a description and its bounding size as **[width, height, depth] in meters**. Keep this module lightweight: implement `loadModel()` with a dynamic import of `./components/<Name>SculptureModel/index.tsx`, as in `block/BlockSculpture.ts`.
2. Build the model around the **center of its foot at local [0, 0, 0]**, with +Y up. Keep its geometry and collider within the declared bounds. The host supplies the socket, world position, and V-to-orbit interaction; do not build a pedestal or add Salon coordinates to the model. Use the supplied `material` from `SculptureModelProps` on every visible mesh. It is the very same instance the socket uses; do not clone, mutate or dispose of it. Include fixed collision matching the visible work, cast and receive shadows, and dispose of geometry the model creates on unmount.
3. Append the class to `sculptures` in `index.ts` under its ID. No Salon changes are needed. As with fountains, changing the pool can change nonzero seeds’ picks; keep the first entry in place for seed 0.
4. Run `bun test test/unit/sculptures.test.ts` to check the catalog, socket fit, lazy model loaders, and seed/preview selection. With WebGPU Chromium on `BROWSER`, `bun run test:live:sculptures` also verifies that each mounted sculpture shares the actual socket material. Inspect the work in the Salon using its preview URL.
