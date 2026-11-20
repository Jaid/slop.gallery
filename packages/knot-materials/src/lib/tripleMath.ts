import type {Vec3} from 'math'

import {vec3} from 'math'

/** Tuple operations for CPU-side knot geometry that leave the input samples untouched. */
export const add = (a: Vec3, b: Vec3) => vec3.add(vec3.create(), a, b)
export const sub = (a: Vec3, b: Vec3) => vec3.sub(vec3.create(), a, b)
export const scale = (a: Vec3, s: number) => vec3.scale(vec3.create(), a, s)
export const cross = (a: Vec3, b: Vec3) => vec3.cross(vec3.create(), a, b)
export const normalize = (a: Vec3) => vec3.normalize(vec3.create(), a)
export const {dot, length} = vec3
