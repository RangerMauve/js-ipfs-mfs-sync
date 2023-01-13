import { IPFSFS } from './ipfs-fs.js'
import { ScopedFS } from './scoped-fs.js'

import { sync } from './sync.js'
export { REMOVE, ADD, CHANGE } from './sync.js'

export default class MFSSync {
  #ipfs = null

  constructor (ipfs) {
    this.#ipfs = ipfs
  }

  async * fromFSToMFS (fromPath, toPath, syncOptions = {}) {
    const fromFS = new ScopedFS(fromPath)
    const toFS = new IPFSFS(this.#ipfs, toPath)

    yield * sync(fromFS, toFS, syncOptions)
  }

  async * fromMFSToMFS (fromPath, toPath, syncOptions = {}) {
    const fromFS = new IPFSFS(this.#ipfs, fromPath)
    const toFS = new IPFSFS(this.#ipfs, toPath)

    yield * sync(fromFS, toFS, syncOptions)
  }

  async * fromMFSToFS (fromPath, toPath, syncOptions = {}) {
    const fromFS = new IPFSFS(this.#ipfs, fromPath)
    const toFS = new ScopedFS(toPath)

    yield * sync(fromFS, toFS, syncOptions)
  }

  async * fromURLToMFS (url, toPath, syncOptions = {}) {
    const fromFS = await IPFSFS.fromURL(this.#ipfs, url)
    const toFS = new IPFSFS(this.#ipfs, toPath)

    yield * sync(fromFS, toFS, syncOptions)
  }

  async * fromURLToFS (url, toPath, syncOptions = {}) {
    const fromFS = await IPFSFS.fromURL(this.#ipfs, url)
    const toFS = new ScopedFS(toPath)

    yield * sync(fromFS, toFS, syncOptions)
  }
}
