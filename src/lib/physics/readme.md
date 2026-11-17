# Item releases

`GrabbableBody` owns a prop’s disabled body while its visual is carried. `PropPlacement` sweeps every collider, including offset stems and covers, from the grip toward the hand. The visible hand retracts against geometry before release. A bounded local contact projection handles a bulky item overlapping a wall or floor at the grip; rays from the grip to its shape centers reject projections through thin walls. There is no search for a distant clear point or return to the pickup pose. If the item cannot fit nearby, release fails and the player keeps holding it until they move into more space.

Mouse release drops a prop, Q/right-click throws it and Escape/unfocus drops it locally. A portrait still hangs when released onto a valid wall; otherwise it drops locally too. Cancellation never restores a plant part to its attachment. The separate below-world recovery safeguard remains for bodies that actually fall out of the world, not obstructed releases.

## Launch and weight

`itemLaunch` adds the carrier’s actual, collision-resolved world velocity to the arm’s impulse. Sprinting forward adds forward speed, a rising jump makes a lob, strafing carries sideways and falling carries downward. A drop adds no arm impulse or spin but inherits the same momentum. A posed capture camera inherits none of the remote player’s motion. Only deliberate prop throws get a `ThrowState` identity for fusion; moving prop drops can strike and sound but do not fuse. Portrait-to-portrait fusion retains its existing contact rules.

`launchSpeed` peaks at 12 m/s around 900 g and rolls off smoothly for lighter and heavier items. Lift and tumble scale with that speed. `itemMass` sums collider masses, including those of fixed/disabled plant parts that become physical on detachment. Assign weight to **colliders**, not `RigidBody.mass`, which React Three Rapier strips from generated colliders. The orb has an explicit ball collider with `orbMass = 1.8` kg; hand throws leave at about 11.3 m/s before carrier motion.

`throw_prop` and the alchemy cannon keep their explicitly requested ballistic velocities. Their controlled shots do not go through the hand’s weight/aim model.

## Player contact

`ReleaseGrace` removes the player membership bit from each released collider’s filter, saving its original groups. The player belongs exclusively to group 1 (`playerCollisionGroups`) and passes those groups into its character-controller queries as well as its actual collider. World contacts and CCD stay enabled. No collider becomes a sensor.

Grace lasts at least 250 ms of **physics time**, then until every released shape is clear of the player by 2 cm. This avoids switching contact on inside the capsule when a drop lands at the player’s feet. `GamePhysics` advances it before the player’s motor, never on a wall-clock timer. Re-grabs, removal and unmount clean it up. Do not repurpose group 1 or mutate an item’s collision masks during grace without updating this ownership scheme.

## Verification

- `test/unit/item-throwing.test.ts`: Rapier trajectories, compound clearance, thin walls, player solver and character-controller contact, grace lifecycle and sound parameters.
- `test/unit/item-interaction.test.ts`: portrait throws/drops/cancellation, refused release and posed-camera momentum.
- `bun run test:live:throwing`: production mouse/keyboard releases, sprint/jump/drop momentum, wall retraction, pause cancellation and a portrait dropped away from its wall. The prop diagnostics expose actual collider mass, velocity and enabled state.
- `test/browser/throwSounds.ts`: standalone offline synthesis of quiet, sprinting and rising releases across light, medium and heavy masses.
