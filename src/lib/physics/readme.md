# Releasing items

`ItemRelease` is the shared physics transaction for props and portraits. `itemMotion` computes the gesture, `throwVoices` sounds it and `PlayerReleaseGrace` temporarily excludes the player from contact. Scripted `throw_prop` calls keep their exact requested velocity or target arc; without an explicit speed they use the same mass-dependent hand speed.

## Placement, not rollback

- Sweep every collider at its body-relative offset and rotation. Leave a 25 mm gap before scenery. Ignore sensors, disabled obstacles and the player, but not other dynamic or kinematic bodies.
- Require a clear starting pose. A shape cast that starts embedded in a thin wall must not “escape” through its far side.
- Constrain the carried prop’s visual with the same sweep every frame, so release does not suddenly pull it inward. If the whole shape cannot fit even at the chest, refuse release and keep it held until the player makes room. In this exceptional case the visual stays at its last clear pose; it is never sent back to the pickup spot.
- Escape, pointer-unlock and blur drop locally too. Portraits still hang at a valid wall preview; releasing without one drops them locally instead of restoring their old wall placement.
- Release leaves world collisions and CCD enabled. For at least 200 ms of **physics time**, exclude only the player’s reserved membership bit, including the Ego motor’s KCC queries. Restore each collider’s original groups once the entire item is clear of the capsule by 4 cm. Do not force restoration on an overlapping pair when a timer expires. Re-grabbing, fusion seizure and unmount clear the grace.
- Until the first physics step after release, override stale render interpolation with the actual release pose, not the old pickup pose.

This does not remove the separate below-world safety net: a genuinely lost body more than 4 m below its floor still recovers as before. Neither a blocked release nor a normal carry interruption uses it. `GrabbableBody.cancel()` remains a low-level abort used by attachment tests, not a player-facing release path.

## Weight and momentum

Hand speed peaks at 10 m/s for 1.8 kg and falls smoothly toward zero at both mass extremes. Examples before inherited momentum:

| Mass | Hand speed |
| ---: | ---: |
| 8 g | 1.33 m/s |
| 350 g | 7.38 m/s |
| 1.8 kg | 10 m/s |
| 30 kg | 4.62 m/s |

The release inherits the player’s actual collision-resolved velocity, including sideways, upward and downward motion. A forward run adds a little drive; rising adds a little loft. Drops get only inherited motion, without the throwing impulse or spin. Only deliberate throws get a fusion attack identity.

Use the mass of the released compound, including disabled decorative shapes that will become solid when released. Orbs have an explicit 1.8 kg ball collider: the React Rapier adapter excludes a body’s `mass` from auto-collider options, so the former body-level default silently left them at unit density (about 11.5 g).

The release sound is filtered air and a soft low exertion: weight lowers its pitch, speed brightens it and upward motion lengthens it. Moving drops make a quieter swish. It plays only on successful release, through the existing world-audio mute, acoustics and pause controls.

## Checks

- `test/unit/item-throwing.test.ts`: mass curve, momentum, attached compound mass, player grace and KCC filtering, obstacle sweeps, portrait geometry and sound recipes.
- `bun run test:live:throwing`: production Chromium, real mouse/keyboard releases, a wall-side capsule-overlapping drop, collision restoration, sprinting, rising jumps, moving drops, interruption, blocked portrait throws and local portrait drops.
- `test/browser/throwingSounds.ts`: offline Web Audio render of each gesture, including headroom and silent tails.
