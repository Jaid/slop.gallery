# rapier-body-contact

Tells what [Rapier](https://rapier.rs) bodies strike, where and how fast, for things like impact sounds, sparks, dents or damage.

Rapier’s own collision events fall short of that. They arrive after the solver has bounced the bodies, when their velocities tell little about how hard they hit. A ball rolling along a floor that is one collider with its walls never starts a new collision when it hits a wall. And a box tumbling to rest starts one collision but lands on four corners.

`BodyContacts` samples the registered bodies around every physics step instead: before the step it takes their motion, and after it, for every point of contact the solver pushed apart that had not touched in the steps before, how fast both sides closed in there along the contact’s normal, spin included.

```typescript
import RAPIER from '@dimforge/rapier3d-compat'
import BodyContacts from 'rapier-body-contact'

const contacts = new BodyContacts<string>({
  onContact({tag, other, point, speed}) {
    console.log(`${tag} struck ${other ?? 'the world'} at ${speed.toFixed(1)} m/s, ${point.y.toFixed(2)} m up`)
  },
})

const unregister = contacts.register(ballBody, 'ball')

contacts.capture()
world.step()
contacts.collect(world)
```

No dependency but Rapier itself, whose `@dimforge/rapier3d-compat` is a peer. Vectors and rotations are plain `{x, y, z}` and `{x, y, z, w}` objects, like Rapier’s own, which three’s `Vector3.copy()` and `Quaternion.copy()` take as they are.

## What counts as a strike

- Only registered bodies strike, and only while they are dynamic, enabled and awake. What they strike can be anything: fixed colliders, other bodies, registered or not.
- A point of contact, told apart by its colliders, their subshapes and their features, strikes when it had not touched within the last `touchSteps` steps. Points that keep touching, like the corner of a box sliding down a wall while it spins, strike once; a box tipping over strikes with every corner it lands on.
- Of all points a body strikes with in one step, the hardest one is reported, once it is faster than `threshold`.
- A body strikes at most once per `cooldown`.
- Two registered bodies striking each other are reported once, for the one registered with the lower body handle, with the other’s tag as `other`.

## The contact

| Field | Description |
| --- | --- |
| `body`, `collider` | the registered body and the collider of it that struck |
| `tag` | what the body was registered as |
| `otherCollider` | the collider it struck |
| `otherBody` | the body it struck, if what it struck belongs to one |
| `other` | the tag of the body it struck, if that is registered too |
| `point` | where they touched, in world space |
| `normal` | the contact’s normal in world space, from the body toward what it struck |
| `speed` | how fast the two closed in on each other along the normal right before the step, in units per second |
| `rotation` | how the body was turned right before the step; turned back by it, the normal tells which side of the body struck |

Rapier reads its solver contact points back with the pose a body has after the step, which is a step’s turn off for anything spinning, like 5 cm on a rolling ball. The points here come from the manifold’s local contact points and the pose taken before the step.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `onContact` | | gets every strike, from within `collect` |
| `threshold` | `0.25` | the speed a strike has to be faster than, in units per second |
| `cooldown` | `0.03` | the least time between two strikes of a body, in seconds |
| `touchSteps` | `4` | how many physics steps a point of contact must not have touched for to strike again |

## Methods

- `register(body, tag)` tells what the body strikes until the function it returns is called. Without a tag type, `register(body)` is enough.
- `capture()` goes right before every `world.step()`, `collect(world)` right after it.
- `recentSpeed(body)` is the fastest a registered body moved right before any of the last `touchSteps` steps. Code that still listens to Rapier’s collision events finds the speed a body arrived with there, after the solver bounced it.

## React

With `@react-three/rapier`, `rapier-body-contact/react` runs a `BodyContacts` around every step of the nearest `Physics`, substeps included:

```tsx
import BodyContacts from 'rapier-body-contact'
import useBodyContacts from 'rapier-body-contact/react'

const contacts = new BodyContacts({onContact: playImpactSound})

function ImpactSounds() {
  useBodyContacts(contacts)
  return null
}
```

Bodies register from their own components, for example in an effect: `useEffect(() => contacts.register(body.current), [])`.
