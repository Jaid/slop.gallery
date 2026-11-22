import loadSandbox from './load.ts'

/** the Sandbox this page opens, with the room its URL chooses, see {@link loadSandbox} */
const sandbox = await loadSandbox()

export default sandbox
