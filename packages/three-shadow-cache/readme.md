# three-shadow-cache

Three.js renders every shadow map every frame, even though most scenes mostly stand still. `ShadowCache` keeps each shadow map until something in its light’s reach changes: a shadow caster that moves, appears, disappears or gets another geometry, or the light itself moving.

```typescript
import ShadowCache from 'three-shadow-cache'

const shadows = new ShadowCache

renderer.setAnimationLoop(() => {
  scene.updateMatrixWorld()
  shadows.update(scene)
  renderer.render(scene, camera)
})
```

It only touches `light.shadow.autoUpdate` and `light.shadow.needsUpdate`, so it works with any renderer of Three r187 that honors them. `dispose()` hands every light back to updating every frame.

## What counts as a change

`update(scene)` walks the visible objects of the scene once per call and compares them with the call before:

- a caster is any visible object with `castShadow` and a geometry. It changed when its world matrix moved by more than the `tolerance`, when its geometry was replaced, when an `InstancedMesh`’s `instanceMatrix` got a new version, and when it appeared or disappeared.
- a light that casts shadows renders its map once when it is first seen, when it moved and when a change lies in its reach: within the range of a point light (its `distance`, or else its shadow camera’s far plane) or inside the shadow camera’s frustum of any other light.

Changes below the tolerance add up until they count, so a settling physics body that wobbles by fractions of a millimeter leaves the maps alone until it has really moved. Shadows that change without their casters moving, like those of skinned or vertex-animated meshes, are not noticed; set `light.shadow.needsUpdate = true` yourself for the lights they concern.

Call it after the world matrices are up to date and before the renderer draws.

## Options

```typescript
const shadows = new ShadowCache({tolerance: 0.001})

shadows.update(scene, {
  hidden,
  active: light => lightsInView.has(light),
})
```

| Option | Default | Description |
| --- | --- | --- |
| `tolerance` | `0.001` | how far a caster or a light may move, in world units and in rotation matrix elements, before it counts as changed |
| `hidden` | none | a set of the subtrees the frame leaves out without making them invisible, like the rooms a portal culling hides |
| `active` | always | whether a light’s shadows matter right now; a light they don’t matter for keeps its pending update until they do |

Hidden casters count as absent for point and spot lights, which then only notice them getting hidden or shown. Directional lights are taken to shine from outside of whatever is hidden and to draw hidden casters too, since a sun’s patches of light would change shape otherwise whenever a room leaves the view. So hiding or showing a caster leaves their maps alone, and a caster changing while hidden waits until anything hidden shows again or something in sight changes.

A new light renders its map right away, even while it is not `active`, as it has nothing to keep yet.

## Helpers

`reachesFrustum(light, frustum)` tells whether a light can shine on anything inside a frustum, wherever the light itself is, which makes a good `active` test for lights outside the view.

`ShadowRefresher` lets shadow maps that left something out render again despite the cache, one map per frame, each in turn, for scenes whose objects load while they already render:

```typescript
import ShadowCache, {ShadowRefresher} from 'three-shadow-cache'

const refresher = new ShadowRefresher

for (const light of shadowLights) {
  refresher.visit(light, shadowCamera => stillLoading(shadowCamera))
}
refresher.endFrame()
shadows.update(scene)
```
