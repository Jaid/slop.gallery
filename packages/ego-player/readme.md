# ego-player

## Interaction and diagnostics

The default controls include E (`interact`), Z (`zoom`) and X (`dump`). E calls `onInteract` once per press. Hold Z for **casual zoom**, which divides the perspective camera's original FOV by `casualZoomFactor` (default 2). While grounded and stationary, press Shift (`sprint`) **after Z is already held** for **extended zoom**, which divides that same original FOV by `extendedZoomFactor` (default 4, not an additional multiplier). If Shift is already held when Z is pressed, that Z hold starts in casual zoom; release and press Shift again while keeping Z held to enter extended zoom. Releasing Shift returns to casual zoom. Movement or jump input immediately starts retracting extended zoom, and the still-held Shift goes straight to the motor for sprinting/dodging or a boosted jump; it does not wait for the camera animation. Airborne motion and residual horizontal movement also prevent extended zoom. Once Shift has armed extended zoom after Z, keeping both held resumes extended zoom when the player comes to rest on the ground. Releasing Z or losing active input restores the normal FOV.

Both modes use a quintic in-out tween: very slow at the start, fast through the middle, and very slow at the end. `casualZoomTransition` controls entering/leaving casual zoom (0.2 seconds by default). `extendedZoomTransition` controls transitions into or out of extended zoom, including a direct return to normal FOV (0.5 seconds by default). Set either duration to 0 for instant transitions of that kind. Interrupted transitions continue from the current FOV without snapping. While extended zoom is active, pointer-lock look speed drops to one tenth of its configured value so fine aiming remains practical at the narrower FOV.

`onZoomChange` exposes the eased normal-to-zoom transition as a normalized 0–1 amount for application-owned presentation effects without requiring React state. Both fully zoomed modes report 1, so moving between them does not reset those effects. Explicit camera handoff through `releaseZoom()` remains immediate so another controller can safely snapshot the unzoomed FOV. Control, Alt and Meta bindings set `modifier` to suppress these actions during shortcuts such as Ctrl+Z.

X does nothing unless `onDump` is supplied. It calls the handler once per press with a compact `EgoDump`: unique ID, timestamp, detached player state, the active input actions, the camera pose (world position, YXZ `yaw`/`pitch`, plus `roll` only when nonzero) with FOV, aspect and clipping planes, and `hits`, every visible mesh/instance surface along the aim ray from near to far. Each hit has its distance, world point, local point (only where it differs), normal, UV, face index, instance ID (only for instances), mesh name, `path` of named ancestors below the scene, scalar metadata merged from the mesh and its ancestors (nearest wins) and the material name if it has one. Lengths are rounded to millimeters and angles, unit vectors and UVs to four decimals; matrices, UUIDs and session-local object IDs are left out since they repeat the pose or change every session. Use `AimInspector` for unrounded hits. Dump raycasts run only on demand; there is no diagnostic raycast when the handler is absent. `AimInspector` is also available as a named package export for read-only inspection outside the controller.

```tsx
<EgoPlayer input={readControls} onInteract={interact} onDump={dump => console.dir(dump, {depth: null})}/>
```

Callbacks require active input and, by default, this player’s canvas pointer lock. Custom readers should return the corresponding action booleans and `modifier` for shortcut suppression. Gameplay remains responsible for the selected target, narration and telemetry delivery.

A composable first-person player for WebGPU React Three Fiber and Rapier: capsule collisions, acceleration, air control, sprinting, directional dodging, crouch clearance, buffered variable-height jumps, coyote time, stairs, slopes and a smoothed camera.

The package owns movement, not your game. Input is an explicit reader; audio, menus, inspection, navigation and telemetry belong to the application. There are no gallery imports, singleton player state, hardcoded DOM selectors or storage dependencies.

This ESM package exports TypeScript source for modern Bun and bundler consumers, following the repository’s other packages. It is not published yet.

## Quick start

```tsx
import type {EgoAction} from 'ego-player'
import {useKeyboardControls} from '@react-three/drei/webgpu'
import {CuboidCollider, RigidBody} from '@react-three/rapier'
import EgoPlayer, {egoControls} from 'ego-player'
import Game from 'three-fiber-game'

function Player() {
  const input = useKeyboardControls<EgoAction>()[1]
  return <EgoPlayer input={input} position={[0, 0.05, 4]}/>
}

export default function App() {
  return <Game controls={egoControls} physics>
    <Player/>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[20, 0.1, 20]} position={[0, -0.1, 0]}/>
    </RigidBody>
  </Game>
}
```

Click the canvas to lock the pointer; Escape unlocks it. The example supplies a physical floor but leaves its visual appearance to you. Provide a nonzero-sized canvas container and a Suspense boundary for physics loading.

`three-fiber-game` is convenient, not a dependency. Alternatively mount `EgoPlayer` inside WebGPU `Canvas` and Rapier `Physics`, with a Drei `KeyboardControls` provider outside Canvas. Convert the readonly bindings for Drei directly:

```tsx
const map = Object.entries(egoControls).map(([name, keys]) => ({
  name,
  keys: typeof keys === 'string' ? [keys] : [...keys],
}))
```

Defaults: W/A/S/D or arrow keys, Space to jump, Shift to sprint/dodge and C to crouch. `egoControls` and its arrays are frozen; create your own mapping to rebind them.

## Input and ownership

`input: () => EgoInput` is the only required prop. It is read once before each physics step, without setting React state. Actions are boolean `forward`, `backward`, `left`, `right`, `jump`, `crouch` and `sprint`; missing actions are false. Readers may return a shared object and extra application actions are ignored. Diagonal movement is normalized.

No keyboard provider is required for custom input:

```tsx
const input = {forward: false, jump: false}

<EgoPlayer input={() => input} pointerLock={false} requirePointerLock={false}/>
```

Update that object from your own controller or input system.

| Prop | Behavior |
| --- | --- |
| `enabled` | Defaults to true. False suppresses input and buffered jumps while deceleration, gravity and collisions continue. It does not pause physics or disable mouse look. |
| `requirePointerLock` | Defaults to true. Input requires a lock on this canvas, not an unrelated element. |
| `pointerLock` | Defaults to true. An object forwards Drei options such as `selector`, `pointerSpeed`, `enabled`, `onLock`, `onUnlock` and `makeDefault`. The component supplies the canvas and defaults `makeDefault` to true. False omits look controls but does not implicitly change the lock requirement. |
| `flying` | Defaults to false. True turns the player into a free-flying camera: `forward`/`backward` move along the look direction including pitch, `left`/`right` strafe, `jump`/`crouch` rise and sink and `sprint` flies at twice the sprint speed (`speed` × `sprintFactor` × 2). Flight speed is constant, without acceleration or deceleration. Gravity is off and the capsule collider is disabled, so the player passes through geometry and stops pushing bodies. Teleports go anywhere, upright, without looking for room, so with `eyeHeight` subtracted they put the eyes at an exact point. Turning it off falls from the current position. |
| `cameraEnabled` | Defaults to true. False releases camera **position** while movement and camera smoothing continue. Control mouse look separately through `pointerLock.enabled` or the default Three controls. |

Both `enabled` and `cameraEnabled` accept a boolean or synchronous predicate. Predicates can read mutable state or an external store without a subscription.

For inspection or a cutscene, disable input and camera positioning, then disable the look controls while your camera system owns rotation. Application-managed pointer locking can pass a selector that matches only the intended lock button, or omit these controls entirely.

Only one `EgoPlayer` should own a given camera and default controls. Use separate roots/cameras or the lower-level motor for additional characters.

## Coordinates and refs

All coordinates are Y-up world coordinates. `position` and snapshots describe the **feet**, not the capsule center or camera. `height` includes the capsule’s round ends. Both eye-height options are distances above the feet. Put the player directly under an untransformed scene/physics root; transformed or scaled ancestors are not supported.

- `position` defaults to `[0, 0.05, 0]` and is read only on mount. Rerenders, new position arrays and option changes do not respawn the player.
- `fallbackPosition` optionally supplies a safe feet position for obstructed spawns and teleports. It is tested too; neither position is accepted if the capsule cannot fit.
- `yaw` and `pitch` default to 0 and use radians. Updating either intentionally reapplies both angles and resets roll, using YXZ order.
- `ref` exposes `body`, `getState()`, `dump()`, `fling(velocity)` and `teleport(feetPosition, cameraQuaternion?)`.
- `fling({x, y, z})` throws the character off with a world-space velocity, replacing its momentum, for knockbacks, blasts and bounce pads. It flies on under the usual gravity and air control from the next physics step. An upward fling leaves the ground and spends coyote time, and releasing jump does not cut it short like a jump; a level fling on the ground slides out under `deceleration`. It is ignored before setup and while flying, and nonfinite velocities throw. `EgoMotor.fling` is the same for non-React consumers.
- `dump()` returns the same `EgoDump` the X key passes to `onDump`, with the current input, or null before setup. It works without `onDump`, e.g. for tooling that wants a snapshot on demand.
- `getState()` returns a detached, readonly-typed snapshot, or null before setup and after cleanup. It contains `active`, `grounded`, `crouching`, `position` and collision-resolved `velocity`. Velocity excludes camera smoothing, bobbing and inspection.
- Teleport resets velocity, ground/coyote history, buffered jumps and camera bob/smoothing. A held jump does not become a fresh press. It preserves crouch state when possible, automatically crouches under low ceilings, uses the resolved stance’s eye height and optionally normalizes the supplied camera quaternion. While `flying`, also when the prop only just turned true, it takes the destination as it is, inside geometry too, and stands upright; `EgoMotor.teleport(position, fallback, flying)` takes the same as its third argument.
- Teleport explicitly updates the camera even when `cameraEnabled` is false. It checks the full capsule at the destination and tries `fallbackPosition` only if neither standing nor crouching fits. If neither destination is safe, it throws before moving the player. It returns the feet position it settled on, the destination or the fallback, so a caller can tell an obstructed teleport from one that arrived, or undefined while it is queued; `EgoMotor.teleport` returns the same. It does not search for a floor or exit an application inspection mode. Calls before setup are no-ops; mount-time calls after setup are copied and queued until sibling colliders are mounted.

```tsx
import type {EgoPlayerHandle} from 'ego-player'
import {useRef} from 'react'

// Inside your component:
const player = useRef<EgoPlayerHandle>(null)

// In a navigation handler after mounting:
player.current?.teleport([4, 0.04, -2], [0, 1, 0, 0])

// Feed a telemetry adapter without subscribing to React state:
const sample = player.current?.getState()
```

Initial placement is resolved before the first physics step or camera frame, whichever comes first. The camera snaps immediately to the resolved eye height instead of smoothing down from a standing view through the ceiling. Newly mounted colliders are checked directly, without relying on a populated physics broad phase; subsequent stand-up checks use the normal spatial query. Sensors, disabled bodies and noninteracting collision groups do not obstruct placement. Existing position-only saves work without persisting stance. Applications still validate world bounds and own persistence; checkpoint the resolved `onUpdate` position, not the requested destination.

Supply finite positions and finite, nonzero quaternions. The body’s `userData` defaults to a per-player `{isPlayer: true}` object, so collision and interaction systems can recognize it without application glue. An explicit `userData` value replaces the default rather than merging with it; omit it or pass `undefined` to restore the default. Optional children attach to the feet-relative body; they do not automatically follow camera bob or crouch height.

## Callbacks

- `onInput(input)`: before movement when input is active and at least one player action is pressed.
- `onLand(state, impactSpeed)`: once after renewed ground contact, with downward speed before collision resolution. Initial placement/teleports and contact interruptions shorter than 0.06 seconds are suppressed. `EgoMotor.landingSpeed` exposes the same one-step signal to non-React consumers.
- `onImpact(impact, state)`: after a physics step for each obstacle the character first touched in it, ground included. `impact.speed` is the collision-resolved speed toward the obstacle along `impact.normal` on the step before, so pressing against a wall does not repeat a hard hit; `impact.airborne` tells jumps and falls from walking. `EgoMotor.impacts` exposes the same one-step list to non-React consumers.
- `onZoomTransition({from, to, direction, duration})`: once per real FOV target change, including mid-animation reversals; seconds match the selected casual/extended transition. Held keys do not repeat it, and explicit camera release/teleport/unmount is silent. Rendering and audio policy remain application-owned.
- `onUpdate(state)`: after each physics step with a detached snapshot. Reading the ref on demand avoids these per-step allocations.
- `onStep(state)`: at a grounded stride’s downward bob trough, at most once per rendered frame. It works with `bobStrength={0}` and does not repeat across frames surrounding one trough.

Callbacks receive current props without remounting the player. The package never plays sounds or chooses a surface material.

## Tuning

Options are flat props and update without rebuilding the rigid body or losing momentum. `undefined` restores a default. `defaultEgoOptions` exports the frozen defaults. Nonfinite numeric options throw; finite out-of-range values are bounded where needed by the motor.

Distances use world units, speeds use world units per second, acceleration/gravity use world units per second squared and durations use seconds. A world unit conventionally represents a meter. Slope angles use degrees; `yaw` and `pitch` use radians.

| Options | Defaults |
| --- | --- |
| `speed`, `sprintFactor`, `crouchFactor` | 3, 3, 0.7 |
| `dodgeFactor`, `dodgeJumpFactor` | 1.5, 1.1 |
| `acceleration`, `deceleration` | 18, 22 |
| `airAcceleration`, `airDeceleration` | 6, 1.5 |
| `height`, `radius`, `crouchHeight` | 1.7, 0.3, 1.2 |
| `eyeHeight`, `crouchEyeHeight` | 1.6, 1.1 |
| `jumpHeight`, `sprintJumpFactor`, `crouchJumpFactor` | 1.5, 1.3, 0.4 |
| `jumpReleaseFactor`, `jumpBufferTime`, `coyoteTime` | 0.55, 0.14, 0.12 |
| `gravity`, `fallGravityFactor`, `maxSpeedDown` | 9.81, 1.35, 30 |
| `contactOffset`, `snapToGround` | 0.02, 0.18 |
| `groundStickSpeed` | 0.18 |
| `stepHeight`, `stepMinWidth` | 0.3, 0.2 |
| `maxSlopeAngle`, `slideAngle` | 50, 55 |
| `pushDynamicBodies`, `characterMass`, `maxPushForce` | true, 80, 800 |
| `cameraSpeed`, `bobStrength`, `bobFrequency` | 18, 0.018, 1.8 |
| `maxDelta` | 0.05 |
| `collisionGroups` | all groups |

Crouching resizes the capsule synchronously before movement; standing is blocked when the full capsule would overlap an obstacle. Radius is at least 0.01, standing height is at least twice the radius and crouch height stays between those bounds. Geometry prop changes intentionally resize the body, so ensure it fits its surroundings.

Holding the `sprint` action while moving forward (including forward diagonals) uses `sprintFactor` and `sprintJumpFactor`. Holding it while moving sideways or backward is a **dodge** and uses `dodgeFactor` and `dodgeJumpFactor` instead. Direction is camera-relative and opposing keys cancel before classification: W + S + A dodges left, while W + A sprints diagonally. Both modes retain the normal acceleration and air-control behavior; dodge is a sustained directional boost, not a timed dash or invulnerability action.

Crouching suppresses both boosts. Without directional input, Shift + jump retains the existing `sprintJumpFactor` bonus. Factors are evaluated when a buffered jump launches, not when it was queued. Jump factors multiply jump **height**, not velocity. Releasing jump multiplies positive vertical velocity by `jumpReleaseFactor`. Grounded and airborne acceleration/deceleration are independent. Gravity is integrated by the motor, not inherited from the Physics world’s gravity.

`snapToGround` only controls Rapier’s maximum snap **distance** in world units. `groundStickSpeed` independently controls the requested downward **speed** while grounded, in world units per second. Its default 0.18 requests 0.003 world units downward per step before collision resolution at 60 physics steps per second, whatever the snap distance. A nonpositive `groundStickSpeed` disables the bias without changing the configured snap distance; there is no hidden minimum speed. Removing the bias can affect ground detection and snapping. Jump launches and airborne gravity remain independent.

Requested horizontal momentum is separate from collision-resolved velocity. Autostep can briefly trade horizontal displacement for vertical lift without resetting acceleration at every riser. Input release and direction changes still decelerate normally; snapshots, footsteps and telemetry report actual motion, including zero speed against a wall.

A nonpositive `stepHeight` or `stepMinWidth` disables autostep; nonpositive `snapToGround` disables snapping. Autostep does not climb dynamic bodies. Actual traversability also depends on capsule shape, contact offset, approach and slope settings; the step-height setting is not a guarantee that every ledge below it is traversable. `characterMass={null}` derives character mass from the body. Pushing transfers momentum like an inelastic hit from `characterMass`, but never more than `maxPushForce` (newtons) per body per step; Rapier's built-in pushing would re-hit a blocked body at full requested speed every step and crush light bodies through their supports. Collision groups filter both movement and stand-up clearance; sensors and disabled colliders are ignored.

`maxDelta` caps simulation catch-up per physics step, with a minimum cap of 1/240. It never enlarges an actual smaller timestep. Reported physical velocity still uses the actual physics interval. Render smoothing independently caps catch-up at 0.1 seconds. `bobFrequency` is the base stride frequency; speed adjusts it. Zero head bob removes visual bobbing without muting stride callbacks.

## Lower-level motor

`EgoMotor` supports headless simulation and custom scene integration:

```ts
import EgoMotor from 'ego-player/motor'

const motor = new EgoMotor(rapier, world, body, capsuleCollider)
// Resolve the initial stance after creating the environment colliders.
motor.teleport([0, 0.04, 0], [4, 0.04, 0])
motor.step(world.timestep, input, camera.quaternion, true)
world.step()
const state = motor.getState()
motor.teleport([0, 0.04, 0])
motor.configure({speed: 4})
motor.dispose()
```

Supply a position-based kinematic body and its dedicated capsule collider from the same initialized Rapier instance/world. The motor owns that collider’s shape and collision groups and schedules body translation. It does not free the world, body or collider. Call `teleport(position, fallbackPosition?)` after mounting the environment to resolve a saved or initial stance, then call `step` before each world step and read snapshots afterward. Direct spawn/teleport clearance scans run only on those transitions, not on ordinary standing movement. `configure` replaces options, restoring omitted defaults. `dispose` removes the character controller and is idempotent; dispose before freeing the world.

The `ego-player/motor` entry has no runtime React imports or browser globals and does not load Fiber, Drei or Rapier’s React bindings. The root entry also re-exports `EgoMotor` for convenience. Its public types reuse the Rapier peer’s types, so no second WASM runtime is bundled. The React component manages this lifecycle automatically.

## Dependencies and checks

Use the manifest’s peer versions: React 19, Three r187, Fiber 10 (whose root entry renders with WebGPU), Drei 11’s WebGPU entry and Rapier 2.2. All are peers, including Drei when `pointerLock={false}`. Rapier’s bare Fiber import already resolves to the same WebGPU module as the host’s Canvas. Do not bundle a second Fiber instance or import the deprecated `@react-three/fiber/webgpu` entry. The package deliberately adds no WebGL compatibility layer.

Run `bun run --cwd packages/ego-player test` from the repository root. Tests exercise real Rapier movement, collisions, clearance, directional sprint/dodge boosts, jumps, teleport resets, independent motors and camera stride timing. A headless React/Fiber test covers Strict Mode, updates without respawning, canvas-specific lock gating, camera ownership, refs and cleanup.

Use `ref.current.releaseZoom()` before another controller captures the camera FOV for an inspection animation. Teleports also release the current zoom. The application coordinates the handoff; merely disabling camera position updates cannot retroactively change a FOV another controller already captured.
