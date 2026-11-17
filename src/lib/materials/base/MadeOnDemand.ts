type Releasable = {dispose: () => void}

/**
 * Materials, textures or groups of them that are each made the first time something asks for one, so that nothing nobody asks for is ever made, like what rooms out of the world’s reach would need. Released together.
 */
export default abstract class MadeOnDemand {
  private readonly made = new Map<string, Releasable>

  dispose() {
    for (const resource of this.made.values()) {
      resource.dispose()
    }
    this.made.clear()
  }

  /** What `key` stands for, which `create` makes the first time it is asked for. */
  protected once<Kind extends Releasable>(key: string, create: () => Kind): Kind {
    let resource = this.made.get(key) as Kind | undefined
    if (!resource) {
      resource = create()
      this.made.set(key, resource)
    }
    return resource
  }
}
