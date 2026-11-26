import {expect, test} from 'bun:test'

// Bun silently drops a patch from the lock once its key no longer names the installed version.
test('every dependency patch matches the installed version and is present in the lock', async () => {
  const {patchedDependencies} = await Bun.file('package.json').json() as {patchedDependencies: Record<string, string>}
  const lock = Bun.JSONC.parse(await Bun.file('bun.lock').text()) as {patchedDependencies: Record<string, string>}
  expect(lock.patchedDependencies).toEqual(patchedDependencies)
  for (const [key, path] of Object.entries(patchedDependencies)) {
    const name = key.slice(0, key.lastIndexOf('@'))
    const installed = await Bun.file(`node_modules/${name}/package.json`).json() as {version: string}
    expect(key).toBe(`${name}@${installed.version}`)
    expect(await Bun.file(path).exists()).toBe(true)
  }
})
test('the installed Three draws backgrounds after the opaque objects, depth tested at the far plane, so a skybox only shades the pixels it shows in', async () => {
  const bundle = await Bun.file(Bun.fileURLToPath(import.meta.resolve('three/webgpu'))).text()
  expect(bundle).toContain('nodeMaterial.depthTest = renderer.logarithmicDepthBuffer !== true;')
  expect(bundle).toContain('viewProj = viewProj.setZ( renderer.reversedDepthBuffer ? 0 : viewProj.w );')
  expect(bundle).toContain('renderList.push( backgroundMesh, backgroundMesh.geometry, backgroundMesh.material, 0, 0, null, null );')
})
