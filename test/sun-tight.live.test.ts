import type {Vec3} from '../src/lib/gallery/types.ts'
import type {BufferGeometry, Material, Object3D, Raycaster, Scene, Sphere} from 'three/webgpu'

import {expect, test} from 'bun:test'
import {join} from 'node:path'

import {waitForLoadingItems} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup} from '../scripts/lib/headlessGallery.ts'
import {lightingPresets} from '../src/lib/gallery/lighting.ts'
import {sunTightSpaces} from '../src/lib/gallery/sun.ts'
import slopGallery from '../src/worlds/gallery/index.ts'

type Space = {
  max: Vec3
  min: Vec3
}
type Leak = {
  point: Vec3
  preset: string
}

/** how far apart the points are that the rays start from, in meters */
const spacing = 0.75
const sunTight: Array<Space> = sunTightSpaces(slopGallery.rooms).map(({min, max}) => ({
  min: min.toArray(),
  max: max.toArray(),
}))
const presetSuns = Object.entries(lightingPresets).map(([preset, {sun}]) => [preset, sun.direction] as const)
const startRoom = slopGallery.rooms.find(room => room.sunTight)?.id
test.skipIf(Bun.env.LIVE_TEST !== 'true')('the sun reaches no point of a sun-tight room’s space in any lighting preset, without what lies inside it', async () => {
  expect(sunTight.length).toBeGreaterThan(0)
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    room: startRoom,
    graphics: 'heavy',
    seed: '1',
    width: '640',
    height: '360',
    warmup_scale: 'false',
  })
  // Three’s devtools hook gives the test the actual mounted meshes, without exposing the scene in the game’s API.
  await using gallery = await openHeadlessGallery(setup, {
    cacheDir: 'node_modules/.vite-sun-tight',
    initScripts: [() => {
      const scenes: Array<Scene> = []
      const observer = new EventTarget
      observer.addEventListener('observe', event => {
        const object = (event as CustomEvent<Scene>).detail
        if (object.isScene) {
          scenes.push(object)
        }
      })
      Object.assign(globalThis, {
        __THREE_DEVTOOLS__: observer,
        sunTightTestScenes: scenes,
      })
    }],
  })
  const {page} = gallery
  const bundle = await Bun.build({
    entrypoints: [join(import.meta.dir, 'lib', 'raycaster.ts')],
    target: 'browser',
    format: 'iife',
    minify: true,
  })
  await page.addScriptTag({content: await bundle.outputs[0].text()})
  await waitForLoadingItems(page)
  const result = await page.evaluate(({directions, spaces, step}: {
    directions: Array<readonly [string, Vec3]>
    spaces: Array<Space>
    step: number
  }) => {
    type Caster = Object3D & {
      boundingSphere?: Sphere | null
      computeBoundingSphere?: () => void
      geometry?: BufferGeometry
      instanceMatrix?: unknown
      isBatchedMesh?: boolean
      isInstancedMesh?: boolean
      isMesh?: boolean
      material?: Array<Material> | Material
    }
    type ShadowMaterial = Material & {
      alphaMap?: unknown
      alphaTestNode?: unknown
      positionNode?: unknown
      shadowSide: number | null
    }
    const {sunTightTestScenes, TestRaycaster} = globalThis as typeof globalThis & {
      sunTightTestScenes: Array<Scene>
      TestRaycaster: new () => Raycaster
    }
    const scene = sunTightTestScenes.find(candidate => candidate.getObjectByName('sun'))!
    scene.updateMatrixWorld(true)
    const within = ({center, radius}: Sphere) => spaces.some(({min, max}) => center.x - radius >= min[0] && center.x + radius <= max[0] && center.y - radius >= min[1] && center.y + radius <= max[1] && center.z - radius >= min[2] && center.z + radius <= max[2])
    /** whether the shadow map holds the material as a raycast sees it: not cut out, see-through or moved by its shader */
    const solid = (material: ShadowMaterial) => !(material.alphaTest > 0 || material.alphaMap || material.alphaTestNode || material.transparent || material.positionNode)
    const blockers: Array<Object3D> = []
    let contents = 0
    const visit = (object: Object3D) => {
      if (!object.visible) {
        return
      }
      const caster = object as Caster
      const {geometry, material} = caster
      if (caster.castShadow && geometry && material && (caster.isMesh || caster.isInstancedMesh || caster.isBatchedMesh)) {
        if (caster.computeBoundingSphere && caster.instanceMatrix) {
          caster.computeBoundingSphere()
        }
        if (!geometry.boundingSphere) {
          geometry.computeBoundingSphere()
        }
        const sphere = (caster.boundingSphere ?? geometry.boundingSphere!).clone().applyMatrix4(caster.matrixWorld)
        if (within(sphere)) {
          // The shadow cache lets these change without redrawing the sun’s map, so they may never block it.
          contents++
        } else if ([material].flat().every(each => solid(each as ShadowMaterial))) {
          blockers.push(caster)
        }
      }
      for (const child of object.children) {
        visit(child)
      }
    }
    visit(scene)
    // Shadow maps draw the faces three flips the side of, which a ray toward the light sees from behind, so the ray takes the material’s own side unless the shadow side is set.
    const sides: Array<[ShadowMaterial, number]> = []
    for (const blocker of blockers) {
      for (const material of [(blocker as Caster).material!].flat() as Array<ShadowMaterial>) {
        if (material.shadowSide === null) {
          continue
        }
        sides.push([material, material.side])
        material.side = material.shadowSide === 2 ? 2 : (1 - material.shadowSide) as 0 | 1
      }
    }
    const raycaster = new TestRaycaster
    const Vector3 = scene.position.constructor as new (x?: number, y?: number, z?: number) => typeof scene.position
    const origin = new Vector3
    const leaks: Array<Leak> = []
    let points = 0
    try {
      for (const [preset, toward] of directions) {
        const direction = new Vector3(...toward)
        direction.normalize()
        for (const {min, max} of spaces) {
          for (let x = min[0]; x <= max[0]; x += step) {
            for (let y = min[1]; y <= max[1]; y += step) {
              for (let z = min[2]; z <= max[2]; z += step) {
                points++
                raycaster.set(origin.set(x, y, z), direction)
                if (!raycaster.intersectObjects(blockers, false).length) {
                  leaks.push({
                    preset,
                    point: [x, y, z],
                  })
                }
              }
            }
          }
        }
      }
    } finally {
      for (const [material, side] of sides) {
        material.side = side as 0 | 1 | 2
      }
    }
    return {
      blockers: blockers.length,
      contents,
      leaks,
      points,
    }
  }, {
    directions: presetSuns,
    spaces: sunTight,
    step: spacing,
  })
  console.error(`${result.points} points of ${sunTight.length} sun-tight spaces in ${presetSuns.length} presets against ${result.blockers} blockers, leaving out ${result.contents} casters inside`)
  expect(result.blockers).toBeGreaterThan(100)
  expect(result.points).toBeGreaterThan(1000)
  expect(result.leaks.slice(0, 20)).toEqual([])
}, 900_000)
