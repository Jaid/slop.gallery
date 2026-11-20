import {Raycaster} from 'three'

// The gallery bundles its own three out of reach; a raycaster of another copy works on its meshes, whose raycast only reads the ray’s numbers.
Object.assign(globalThis, {TestRaycaster: Raycaster})
