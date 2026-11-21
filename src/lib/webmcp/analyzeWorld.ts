import type {BufferAttribute, BufferGeometry, InstancedBufferGeometry, InstancedMesh, Light, Material, Mesh, Object3D, PointLight, SpotLight} from 'three/webgpu'
import type {Arrayable} from 'type-fest'

import {Box3, Matrix4, Vector3} from 'three/webgpu'

import {lampOf} from '../rendering/lamps.ts'
import {isShadowSlot} from '../rendering/lightLevels.ts'
import {wantsShadow} from '../rendering/shadowPool.ts'

/** an axis-aligned box in world meters, from the floor to the clear height of the space it covers */
export type WorldBox = {
  max: [number, number, number]
  min: [number, number, number]
}
/** a room as the union of its fence’s boxes */
export type WorldRoom = {
  fence: Arrayable<WorldBox>
  id: string
  title: string
}
export type WorldMesh = {
  /** instances of an instanced mesh; left out where it is 1 */
  instances?: number
  /** material name or type, a list for several; left out where it is the plain MeshStandardNodeMaterial */
  material?: Arrayable<string>
  /** names of the mesh and its named ancestors, outermost first */
  path: string
  /** the other rooms holding at least 1% of the mesh’s bounding volume, most first; the mesh itself is listed in the region holding the most */
  spill?: Arrayable<string>
  /** triangles drawn for these instances */
  triangles: number
}
/** something the player can pick up and carry into another room, like a prop or a portrait */
export type WorldItem = {
  /** its prop or portrait id */
  id: string
  /** meshes drawing it, each instanced batch it is part of counting once */
  meshes: number
  /** triangles drawn for it */
  triangles: number
}
export type WorldLight = {
  angle?: number
  color: string
  decay?: number
  distance?: number
  intensity: number
  path: string
  penumbra?: number
  position: [number, number, number]
  /** own where the light casts a shadow map of its own, pooled where it borrows one of the shadow pool’s while in view; left out without a shadow */
  shadow?: 'own' | 'pooled'
  type: string
}
/** a light of another region that shines while the player stands in this room */
export type ForeignLight = {
  path: string
  /** the room the light sits in; left out for passages, stairways and the outdoors */
  room?: string
}
export type WorldRegion = {
  /** what can be picked up, by where it lies now, sorted by triangles, most first */
  items: Array<WorldItem>
  lights: Array<WorldLight>
  /** everything else, the static meshes, sorted by triangles, most first */
  meshes: Array<WorldMesh>
}
export type WorldAnalysis = {
  /** meshes mostly outside every room’s fence and positioned lights outside every fence seen from above: passages, stairways and the outdoors */
  elsewhere: WorldRegion
  /** ambient, hemisphere and directional lights, which light the world without a place in it */
  globalLights: Array<WorldLight>
  /** keyed by room id, in the world’s room order */
  rooms: Record<string, Omit<WorldRoom, 'id'> & WorldRegion & {
    /** positioned lights of other regions left on while the player stands here: those the world lights everywhere and those it lights in this room or in a part of it */
    foreignLights: Array<ForeignLight>
  }>
}

const globalLightTypes = new Set(['AmbientLight', 'DirectionalLight', 'HemisphereLight', 'LightProbe'])
const round = (value: number) => Math.round(value * 1e4) / 1e4 + 0
/** Planes get a centimeter of depth, so they have a volume to share between rooms too. */
const minimumExtent = 0.01
/** the smallest share of a mesh’s bounding volume that counts as spilling into a room */
const minimumSpill = 0.01
const center = new Vector3
const size = new Vector3
const instanceMatrix = new Matrix4
const matrix = new Matrix4
const extent = new Box3
const overlap = new Box3
const volumeOf = (box: Box3) => {
  box.getSize(size)
  return size.x * size.y * size.z
}
/** how far the point lies above or below the box, with a meter below its floor and 20 cm above its top to spare; undefined unless it is at least 1 mm inside the box seen from above, so walls centered on a shared boundary belong to neither room */
function verticalDistance({x, y, z}: Vector3, {min, max}: WorldBox) {
  if (x > min[0] + 1e-3 && x < max[0] - 1e-3 && z > min[2] + 1e-3 && z < max[2] - 1e-3) {
    return Math.max(min[1] - 1 - y, y - max[1] - 0.2, 0)
  }
}
const pathOf = (object: Object3D) => {
  const names: Array<string> = []
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.name) {
      names.unshift(current.name)
    }
  }
  if (!object.name) {
    names.push(object.type)
  }
  return names.join('/')
}
/** triangles of one draw of the geometry, within its draw range */
const trianglesOf = (geometry: BufferGeometry) => {
  const position = geometry.getAttribute('position') as BufferAttribute | undefined
  const count = geometry.index?.count ?? position?.count ?? 0
  const drawn = Math.min(count - geometry.drawRange.start, geometry.drawRange.count)
  const {instanceCount} = geometry as Partial<InstancedBufferGeometry>
  const instances = instanceCount !== undefined && Number.isFinite(instanceCount) ? instanceCount : 1
  return Math.floor(Math.max(drawn, 0) / 3) * instances
}
const materialOf = (mesh: Mesh) => {
  const names = [...new Set((Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material: Material) => material.name || material.type))].filter(name => name !== 'MeshStandardNodeMaterial')
  return names.length > 1 ? names : names.at(0)
}
const describeLight = (light: Light): WorldLight => {
  const spot = light as SpotLight
  return {
    type: light.type,
    path: pathOf(light),
    position: light.getWorldPosition(center).toArray().map(round) as [number, number, number],
    color: `#${light.color.getHexString()}`,
    intensity: round(light.intensity),
    ...'distance' in light ? {
      distance: round(spot.distance),
      decay: round(spot.decay),
    } : {},
    ...spot.isSpotLight ? {
      angle: round(spot.angle),
      penumbra: round(spot.penumbra),
    } : {},
    ...light.castShadow ? {shadow: 'own'} : ((light as PointLight).isPointLight && wantsShadow(light) ? {shadow: 'pooled'} : {}),
  }
}
/** the pickup the object belongs to: the nearest object above it, itself included, that sets `userData.pickup` */
const pickupOf = (object: Object3D) => {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.userData.pickup) {
      return current
    }
  }
}
const itemIdOf = (pickup: Object3D) => String(pickup.userData.propId ?? pickup.userData.portraitId ?? pathOf(pickup))

/**
 * Sorts every visible mesh of the scene into the region holding most of its world bounding box, summed over all instances, and lists the other rooms it spills into.
 * Pickups (`userData.pickup`) and the instances of batches drawing them (`userData.propIds`, the prop of every instance) are items instead, which count in the room holding their origin, as they can be carried anywhere.
 * Fences count with a meter below their floor and 20 cm above their top to spare. A mesh that meets no fence, like a crater floor, and every light go to the room whose
 * fence holds their center seen from above, the one nearest in height where several do. Counts follow the geometry’s draw range and instance count, not what culling
 * skips in a given frame.
 * `fencesIn` gives the ids of the fences a player in a room may be in, which the world lights its lamps by: by default only the room’s own.
 */
export default function analyzeWorld(scene: Object3D, rooms: ReadonlyArray<WorldRoom>, fencesIn: (room: string) => ReadonlyArray<string> = room => [room]): WorldAnalysis {
  scene.updateMatrixWorld()
  const regions = new Map<string | undefined, WorldRegion>([...rooms.map(room => room.id), undefined].map(id => [id, {
    meshes: [],
    items: [],
    lights: [],
  }]))
  /** by pickup, with the room holding its origin */
  const items = new Map<Object3D, WorldItem & {room?: string}>
  /** batches drawing pickups, resolved once every pickup is known */
  const batches: Array<{
    ids: ReadonlyArray<string>
    mesh: InstancedMesh
    triangles: number
  }> = []
  const globalLights: Array<WorldLight> = []
  const placed: Array<ForeignLight & {fences?: ReadonlyArray<string>}> = []
  const fences = rooms.map(room => ({
    id: room.id,
    boxes: [room.fence].flat().map(({min, max}) => new Box3(new Vector3(min[0], min[1] - 1, min[2]), new Vector3(max[0], max[1] + 0.2, max[2]))),
  }))
  // Crater floors and skylight lamps reach past their room’s fence, so the nearest box above or below the point counts too.
  const roomAt = (point: Vector3) => {
    let result: {
      distance: number
      id: string
    } | undefined
    for (const room of rooms) {
      for (const box of [room.fence].flat()) {
        const distance = verticalDistance(point, box)
        if (distance !== undefined && (!result || distance < result.distance)) {
          result = {
            id: room.id,
            distance,
          }
        }
      }
    }
    return result?.id
  }
  scene.traverseVisible(object => {
    // Parents come first, so every pickup is known before the meshes inside it.
    if (object.userData.pickup) {
      items.set(object, {
        id: itemIdOf(object),
        meshes: 0,
        triangles: 0,
        room: roomAt(object.getWorldPosition(center)),
      })
    }
    // The shadow pool’s slots only stand in for other lights.
    if ((object as Light).isLight && isShadowSlot(object)) {
      return
    }
    if ((object as Light).isLight) {
      const light = describeLight(object as Light)
      if (globalLightTypes.has(light.type)) {
        globalLights.push(light)
      } else {
        const room = roomAt(center.fromArray(light.position))
        regions.get(room)!.lights.push(light)
        placed.push({
          path: light.path,
          ...room === undefined ? {} : {room},
          fences: lampOf(object as Light)?.fences,
        })
      }
      return
    }
    if (!(object as Partial<Mesh>).isMesh) {
      return
    }
    const mesh = object as Mesh
    const {geometry} = mesh
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox()
    }
    const instanced = (mesh as Partial<InstancedMesh>).isInstancedMesh ? mesh as InstancedMesh : undefined
    const instances = instanced?.count ?? 1
    const pickup = pickupOf(mesh)
    if (pickup) {
      const item = items.get(pickup)!
      item.meshes++
      item.triangles += trianglesOf(geometry) * instances
      return
    }
    const propIds = mesh.userData.propIds as ReadonlyArray<string> | undefined
    if (instanced && propIds) {
      batches.push({
        ids: propIds.slice(0, instances),
        mesh: instanced,
        triangles: trianglesOf(geometry),
      })
      return
    }
    const volumes = new Map<string | undefined, number>
    const add = (id: string | undefined, volume: number) => volumes.set(id, (volumes.get(id) ?? 0) + volume)
    for (let i = 0; i < instances; i++) {
      matrix.copy(mesh.matrixWorld)
      if (instanced) {
        instanced.getMatrixAt(i, instanceMatrix)
        matrix.multiply(instanceMatrix)
      }
      extent.copy(geometry.boundingBox!).applyMatrix4(matrix).getSize(size)
      extent.expandByVector(size.set(Math.max(minimumExtent - size.x, 0) / 2, Math.max(minimumExtent - size.y, 0) / 2, Math.max(minimumExtent - size.z, 0) / 2))
      const volume = volumeOf(extent)
      let inside = 0
      for (const {id, boxes} of fences) {
        const shared = Math.min(boxes.reduce((sum, box) => sum + (overlap.copy(extent).intersect(box).isEmpty() ? 0 : volumeOf(overlap)), 0), volume - inside)
        if (shared <= 0) {
          continue
        }
        add(id, shared)
        inside += shared
      }
      if (inside === 0) {
        add(roomAt(extent.getCenter(center)), volume)
      } else if (volume > inside) {
        add(undefined, volume - inside)
      }
    }
    let owner: string | undefined
    let most = -1
    let total = 0
    for (const [id, volume] of volumes) {
      total += volume
      if (volume <= most) {
        continue
      }
      owner = id
      most = volume
    }
    const spill = [...volumes].filter(([id, volume]) => id !== undefined && id !== owner && volume >= total * minimumSpill).toSorted((x, y) => y[1] - x[1]).map(([id]) => id!)
    const material = materialOf(mesh)
    regions.get(owner)!.meshes.push({
      path: pathOf(mesh),
      ...instances === 1 ? {} : {instances},
      ...material === undefined ? {} : {material},
      ...spill.length ? {spill: spill.length > 1 ? spill : spill[0]} : {},
      triangles: trianglesOf(geometry) * instances,
    })
  })
  const byId = new Map(items.values().map(item => [item.id, item]))
  for (const {ids, mesh, triangles} of batches) {
    for (const [index, id] of ids.entries()) {
      let item = byId.get(id)
      // An instance whose prop isn’t in the scene still draws where it was last.
      if (!item) {
        mesh.getMatrixAt(index, instanceMatrix)
        item = {
          id,
          meshes: 0,
          triangles: 0,
          room: roomAt(center.setFromMatrixPosition(matrix.multiplyMatrices(mesh.matrixWorld, instanceMatrix))),
        }
        byId.set(id, item)
      }
      item.meshes++
      item.triangles += triangles
    }
  }
  for (const {room, ...item} of byId.values()) {
    regions.get(room)!.items.push(item)
  }
  for (const region of regions.values()) {
    region.meshes.sort((a, b) => b.triangles - a.triangles)
    region.items.sort((a, b) => b.triangles - a.triangles)
  }
  return {
    rooms: Object.fromEntries(rooms.map(({id, ...room}) => {
      const within = fencesIn(id)
      return [id, {
        ...room,
        ...regions.get(id)!,
        foreignLights: placed.filter(light => light.room !== id && (!light.fences || light.fences.some(fence => within.includes(fence)))).map(({path, room: home}) => (home === undefined ? {path} : {
          path,
          room: home,
        })),
      }]
    })),
    elsewhere: regions.get(undefined)!,
    globalLights,
  }
}
