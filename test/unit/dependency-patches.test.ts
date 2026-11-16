import {expect, test} from 'bun:test'

// Bun silently drops a patch from the lock once its key no longer names the installed version.
test.each(['three', '@react-three/rapier'])('the %s patch tracks the installed version and root lock', async name => {
  const manifest = await Bun.file('package.json').json() as {
    dependencies: Record<string, string>
    patchedDependencies: Record<string, string>
  }
  const patchKey = `${name}@${manifest.dependencies[name]}`
  const patchPath = `patches/${patchKey.replace('/', '%2F')}.patch`
  expect(manifest.patchedDependencies[patchKey]).toBe(patchPath)
  expect(await Bun.file(patchPath).exists()).toBe(true)
  expect(await Bun.file('bun.lock').text()).toContain(`"${patchKey}": "${patchPath}"`)
})
test('the installed Three draws backgrounds after the opaque objects, depth tested at the far plane, so a skybox only shades the pixels it shows in', async () => {
  const bundle = await Bun.file(Bun.fileURLToPath(import.meta.resolve('three/webgpu'))).text()
  expect(bundle).toContain('nodeMaterial.depthTest = renderer.logarithmicDepthBuffer !== true;')
  expect(bundle).toContain('viewProj = viewProj.setZ( renderer.reversedDepthBuffer ? 0 : viewProj.w );')
  expect(bundle).toContain('renderList.push( backgroundMesh, backgroundMesh.geometry, backgroundMesh.material, 0, 0, null, null );')
})
