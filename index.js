import { IPFSFS } from './ipfs-fs.js'
import { ScopedFS } from './scoped-fs.js'

import { sync } from './sync.js'

export default class MFSSync {
  #ipfs = null

  constructor (ipfs) {
    this.#ipfs = ipfs
  }

  async * fromFSToMFS (fromPath, toPath) {
    const fromFS = new ScopedFS(fromPath)
    const toFS = new IPFSFS(this.#ipfs, toPath)

    yield * sync(fromFS, toFS)
  }

  async * fromMFSToMFS (fromPath, toPath) {
    const fromFS = new IPFSFS(this.#ipfs, fromPath)
    const toFS = new IPFSFS(this.#ipfs, toPath)

    yield * sync(fromFS, toFS)
  }

  async * fromMFSToFS (fromPath, toPath) {
    const fromFS = new IPFSFS(this.#ipfs, fromPath)
    const toFS = new ScopedFS(toPath)

    yield * sync(fromFS, toFS)
  }

  async * fromURLToMFS (url, toPath) {
    const fromFS = await IPFSFS.fromURL(this.#ipfs, url)
    const toFS = new IPFSFS(this.#ipfs, toPath)

    yield * sync(fromFS, toFS)
  }

  async * fromURLToFS (url, toPath) {
    const fromFS = await IPFSFS.fromURL(this.#ipfs, url)
    const toFS = new ScopedFS(toPath)

    yield * sync(fromFS, toFS)
  }
}
