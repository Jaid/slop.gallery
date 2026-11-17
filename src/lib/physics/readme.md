# Carrying, dropping and throwing

Every prop the player can pick up is a `GrabbableProp` (`src/components/Scene`) around a `GrabbableBody`: carried, its body is out of the physics where it was picked up and its group floats in front of the camera. Letting go has three parts, each in a file of its own.

## Where it leaves the hand

`PropPlacement.letGo` finds where a prop is let go of, from inside the player’s capsule (`origin`, 22 cm below the eye) toward where it was shown (`target`):

1. `sweep` casts every collider of the prop along that line and stops short of the first thing any of them meets, the player’s capsule left out.
2. Where the prop doesn’t fit there, like a large prop held against a wall that it reaches into from the start, `free` pushes it out of its deepest overlap, a little clear of it, again and again, as a hand squeezes something out of a corner.
3. Where that doesn’t free it, or pushes it through to the far side of something between it and the hand, the same is tried further back along the line, at ¾, ½, ¼ and right at `origin`.
4. Where it fits nowhere, it is let go of wherever it is in the least, and the solver pushes it out of the rest.

So a prop always leaves the hand near it. Nothing ever teleports back to where it was picked up anymore. That only happens to a prop that fell out of the world (`GrabbableBody.recover`), and to a canceled pluck or re-grab in the tests.

## Passing through the player

A hand lets go of things within the body’s reach, so a prop often leaves the hand partly inside the player’s capsule, and always does when the player looks down at its feet. The player’s capsule therefore has a collision group of its own (`collisionGroups.ts`), which `Player` gives `ego-player` through `collisionGroups`. Every prop that leaves the hand, by a throw, a drop or `fling`, and every thrown work starts a `PlayerGrace`: its colliders drop the player’s group for at least `graceTime` (0.25 s) and then until they are 4 cm clear of the capsule. Meanwhile neither shoves the other, so a prop dropped at the feet falls straight down through the legs and stays there until the player steps off it. Everything else still collides as ever. `Player` steps every grace after each physics step, and grabbing ends one at once.

## How it flies

`throwMotion.ts` turns the prop’s mass and the player’s motion into a `Toss`: the velocity and spin it leaves with, and how much of a run-up (`drive`) and of a jump (`rise`) went into it, which its sound follows.

- **Mass:** `throwSpeedFor` gives an orb (1.8 kg) the old 10 m/s. Heavier things have to share the arm’s swing with their mass (a pumpkin 7.3 m/s, a potted plant about 7 m/s), and light ones slip off the fingers with little to push against (a palette knife peaks at 13 m/s, a leaf 4.7 m/s), so both fly short. `GrabbableBody.mass` sums the colliders’ masses, a leaf’s disabled ones included. Colliders without a mass of their own weigh by their volume at Rapier’s default density of 1 kg/m³, next to nothing for something hand-sized, so the curios, orbs (`orbMass`), plants and Knot nameplates give theirs. The Knots’ hulls don’t, which makes each 1.2 m Knot weigh 0.9 kg and throw like a light thing.
- **Moving with the player:** whatever leaves the hand carries on with the body’s actual velocity (`carrierVelocity`, level while grounded). A drop on the run therefore sails on like a small throw, and a drop mid-jump flies on up. A drop standing still just falls, without a spin.
- **Run-up:** running in the direction of the throw drives it up to a fifth faster and much flatter, by how much of a sprint (9 m/s) there is.
- **Jump shot:** rising at the start of a jump turns the throw up to 40° higher and two fifths softer, by how much of the jump’s takeoff speed is left. It lobs up high and drops steeply, like a basketball shot. Falling, backing away or running sideways only adds the body’s velocity.

The `throw_prop` tool throws at the prop’s own `throwSpeedFor` unless told a speed. `renderFusion.ts` keeps throwing orbs at `throwSpeed`.

## Validation

`test/unit/grabbable-body.test.ts` covers letting go into a wall and with no room, the grace (a player walking on through a prop dropped at its feet with `EgoMotor`; without the player’s own group, it shoves the prop along or climbs over it), drops and throws on the run and by mass. `test/unit/props.test.ts` covers `sweep` and `letGo`, `test/unit/throw-motion.test.ts` covers `toss` and its sound.
