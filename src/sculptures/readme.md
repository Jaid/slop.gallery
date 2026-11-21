# Sculptures

The Salon displays one sculpture on its permanent 3.2 m × 3.2 m stone socket. The environment seed picks from the ordered registry in `index.ts`, independently of the fountain or other exhibits. Seed 0 always shows the first entry: **Block**, an upright block of the same sawn stone as its socket.

**Antiphon** (`?room=salon&sculpture=antiphon`) is a single loop of carved stone with seven twisting flutes and two hollow, scalloped bells. From the doorway its throats cross; orbit it with V to see the space between them.

**Tung Tung Tung Sahur** (`?room=salon&sculpture=tung_tung_tung_sahur`) is a wooden figure with enamel eyes, a carved grin and a bat resting beside its feet. It uses one indexed mesh with 32 520 triangles.

Use `?room=salon&sculpture=<id>` to preview any work regardless of the seed. An unknown ID falls back to the seeded pick.

## Contributing a sculpture

1. Create `src/sculptures/<id>/<Name>Sculpture.ts` extending `base/Sculpture.ts`. Give it a stable ID matching its folder, a title, a description, its bounding size as **[width, height, depth] in meters** and its **mass in kilograms**. Estimate the mass from the sculpture’s volume and material density. Keep this module lightweight: implement `loadModel()` with a dynamic import of `./components/<Name>SculptureModel/index.tsx`, as in `block/BlockSculpture.ts`.
2. Build the model around the **center of its foot at local [0, 0, 0]**, with +Y up. The host supplies the fixed socket, the sculpture’s dynamic rigid body and the V-to-orbit interaction. Include colliders matching the work and distribute the supplied `mass` across them. Stone works can use the supplied `material`, the same instance the socket uses. The socket owns it; do not mutate or dispose of it. A sculpture with its own finish should own and dispose of its material. Cast and receive shadows and dispose of geometry the model creates on unmount.
3. Append the class to `sculptures` in `index.ts` under its ID. No Salon changes are needed. As with fountains, changing the pool can change nonzero seeds’ picks; keep the first entry in place for seed 0.
4. Run `bun test test/unit/sculptures.test.ts` to check the catalog, socket fit, lazy model loaders, and seed/preview selection. With WebGPU Chromium on `BROWSER`, `bun run test:live:sculptures` also verifies the material and triangle count of the mounted sculptures. Inspect the work in the Salon using its preview URL.
