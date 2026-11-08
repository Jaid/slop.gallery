import type {Group, Object3D} from 'three/webgpu'

/**
 * Puts everything under `root` at `order` among the scene’s groups, which three.js sorts its draws by before their own render order: sets the render order of `root` and of every group under it, as three.js takes a group’s render order for everything under it only as far as the next group, which brings its own.
 * Groups added under `root` afterward keep their own.
 */
export default function setGroupOrder(root: Object3D, order: number) {
  root.traverse(object => {
    if ((object as Partial<Group>).isGroup) {
      object.renderOrder = order
    }
  })
}
