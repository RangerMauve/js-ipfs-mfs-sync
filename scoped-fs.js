// Implements a subset of the Node.js FS module (with promises) via MFS/IPFS
import { posix } from 'path'
import * as fsPromise from 'node:fs/promises'
// readdir, createreadstream, createwritestream

export class ScopedFS {
  constructor (root = process.pwd(), fs = fsPromise) {
    this.root = root
    this.fs = fs
  }

  #resolve (path) {
    return posix.join(this.root, path)
  }

  async readdir (path, { withFileTypes = true, ...args } = {}) {
    const fullPath = this.#resolve(path)
    return this.fs.readdir(fullPath, { withFileTypes, ...args })
  }

  async stat (path, ...args) {
    const fullPath = this.#resolve(path)
    return this.fs.stat(fullPath, ...args)
  }

  async mkdir (path, ...args) {
    const fullPath = this.#resolve(path)
    return this.fs.mkdir(fullPath, ...args)
  }

  async open (path, ...args) {
    const fullPath = this.#resolve(path)
    return this.fs.open(fullPath, ...args)
  }

  async rm (path, ...args) {
    const fullPath = this.#resolve(path)
    return this.fs.rm(fullPath, ...args)
  }
}
