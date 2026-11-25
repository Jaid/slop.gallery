import type {Object3D} from 'three/webgpu'

import {Minimatch} from 'minimatch'

const isScene = (object: Object3D) => Boolean((object as Object3D & {isScene?: boolean}).isScene)
/** the matcher of the last pattern, since the wireframe looks its highlight up every frame */
let compiled: {
  matcher: Minimatch
  pattern: string
} | undefined
/** A minimatch pattern only has to match the end of a mesh path, so a lone name matches that object wherever it is. */
export const compileMeshPattern = (pattern: string) => {
  if (compiled?.pattern !== pattern) {
    compiled = {
      matcher: new Minimatch(`**/${pattern}`, {
        dot: true,
        nocomment: true,
        nonegate: true,
      }),
      pattern,
    }
  }
  return compiled.matcher
}
const join = (path: string, name: string) => (path ? `${path}/${name}` : name)

/** A mesh pattern without spaces around its slashes and without empty segments, or undefined when nothing is left. */
export function normalizeMeshPattern(value: unknown) {
  if (typeof value !== 'string') {
    return
  }
  const segments = value.split('/').map(segment => segment.trim()).filter(Boolean)
  if (segments.length > 0) {
    return segments.join('/')
  }
}

/** The names of the object and its named ancestors below the scene, joined by slashes, like the X dump’s `path` followed by its `mesh`: unnamed wrappers are left out. */
export function meshPath(object: Object3D) {
  let path = ''
  for (let current: Object3D | null = object; current && !isScene(current); current = current.parent) {
    if (current.name) {
      path = path ? `${current.name}/${path}` : current.name
    }
  }
  return path
}

/** Whether a named object’s mesh path ends in a match of the minimatch pattern, like `alchemy-cannon`, `lobby-fountain/fountain-*` or `alchemy-machine/{alchemy-machine,alchemy-cannon}`. */
export function matchesMeshPattern(object: Object3D, pattern: string) {
  return Boolean(object.name) && compileMeshPattern(pattern).match(meshPath(object))
}

/** Every named object whose mesh path ends in a match of the minimatch pattern, together with everything below it. */
export function collectMeshPattern(root: Object3D, pattern: string) {
  const matcher = compileMeshPattern(pattern)
  const objects: Array<Object3D> = []
  const visit = (object: Object3D, parentPath: string) => {
    const named = Boolean(object.name) && !isScene(object)
    const path = named ? join(parentPath, object.name) : parentPath
    if (named && matcher.match(path)) {
      object.traverse(descendant => {
        objects.push(descendant)
      })
      return
    }
    for (const child of object.children) {
      visit(child, path)
    }
  }
  visit(root, root.parent ? meshPath(root.parent) : '')
  return objects
}
