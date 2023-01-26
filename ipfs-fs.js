// Implements a subset of I'd like to the Node.js FS module (with promises) via MFS/IPFS
import { posix } from 'path'
import { Readable, Transform } from 'streamx'

const FS_ROOT = '/mfs-sync/'
const IPFS_URL_PREFIX = 'ipfs://'
const IPNS_URL_PREFIX = 'ipns://'
const customInspectSymbol = Symbol.for('nodejs.util.inspect.custom')

// TODO: Add timeouts everywhere

export class IPFSFS {
  static async fromURL (ipfs, url, destination = null) {
    // Resolve URL and copy it to MFS
    if (url.startsWith(IPFS_URL_PREFIX)) {
      const rawPath = url.slice(IPFS_URL_PREFIX.length)
      const ipfsPath = '/ipfs/' + rawPath

      const mfsPath = destination || posix.join(FS_ROOT, ipfsPath)

      await copyFromPath(ipfs, ipfsPath, mfsPath)

      return new IPFSFS(ipfs, mfsPath)
    } else if (url.startsWith(IPNS_URL_PREFIX)) {
      const rawPath = url.slice(IPNS_URL_PREFIX.length)
      const segments = rawPath.split('/')
      const suffix = segments.slice(1).join('/')
      const domain = segments[0]
      const ipnsPath = '/ipns/' + domain

      const results = await collect(ipfs.name.resolve(ipnsPath))
      if (!results.length) {
        throw new Error(`Unable to resolve IPNS domain ${domain}`)
      }
      // The final resolve should always be an IPFS path
      // Might have some intermediate IPNS paths
      const ipfsPath = results.at(-1)

      if (destination) {
        const fullIPFSPath = posix.join(ipfsPath, suffix)
        await copyFromPath(ipfs, fullIPFSPath, destination)
        return new IPFSFS(ipfs, destination)
      } else {
        const mfsPath = posix.join(FS_ROOT, ipnsPath)

        await copyFromPath(ipfs, ipfsPath, mfsPath)

        const mfsFullPath = posix.join(mfsPath, suffix)

        return new IPFSFS(ipfs, mfsFullPath)
      }
    } else {
      throw new Error(`Must supply ipfs:// or ipns:// URL, got ${url}`)
    }
  }

  constructor (ipfs, root) {
    this.ipfs = ipfs
    this.root = root
  }

  #resolve (path) {
    return posix.join(this.root, path)
  }

  async flush () {
    await this.ipfs.files.flush(this.root)
  }

  async readdir (path, { withFileTypes = false } = {}) {
    const fullPath = this.#resolve(path)
    const itemIterator = this.ipfs.files.ls(fullPath)
    const entries = []
    for await (const stat of itemIterator) {
      if (withFileTypes) {
        entries.push(new IPFSStat(stat))
      } else {
        entries.push(stat.name)
      }
    }
    return entries
  }

  async stat (path) {
    const fullPath = this.#resolve(path)

    const segments = fullPath.split('/')
    // Account for paths ending in a /
    if (!segments.at(-1)) {
      segments.pop()
    }

    // This is the only way to get the mtime of a file or directory
    // The regular .stat() API just gives you the size
    // This is due to UnixFS storing the mtime in the directory object
    const parentPath = segments.slice(0, -1).join('/') || '/'
    const file = segments.at(-1)

    for await (const stat of this.ipfs.files.ls(parentPath)) {
      if (stat.name !== file) continue
      return new IPFSStat(stat)
    }

    throw new Error('Not found')
  }

  async mkdir (path) {
    const fullPath = this.#resolve(path)
    await this.ipfs.files.mkdir(fullPath, {
      flush: true
    })
  }

  async open (path) {
    // Create a file handle with a read stream and a write stream
    const fullPath = this.#resolve(path)
    return new IPFSFileHandle(this.ipfs, fullPath)
  }

  async rm (path) {
    const fullPath = this.#resolve(path)
    await this.ipfs.files.rm(fullPath, {
      recursive: true,
      flush: true
    })
  }
}

export class IPFSStat {
  #stat = null
  constructor (stat) {
    this.#stat = stat
  }

  get size () {
    return this.#stat.size
  }

  get name () {
    return this.#stat.name
  }

  get mtime () {
    return this.#stat.mtime
  }

  get utime () {
    return this.#stat.mtime
  }

  get mode () {
    return this.#stat.mode
  }

  isFile () {
    return this.#stat.type === 'file'
  }

  isDirectory () {
    return this.#stat.type === 'directory'
  }

  [customInspectSymbol] (...args) {
    return this.#stat
  }
}

export class IPFSFileHandle {
  constructor (ipfs, path) {
    this.ipfs = ipfs
    this.path = path
  }

  createReadStream (options) {
    const data = this.ipfs.files.read(this.path)
    return Readable.from(data)
  }

  createWriteStream (options = {}) {
    const transform = new Transform()
    const data = Readable.from(transform)
    this.ipfs.files.write(this.path, data, {
      create: true,
      parents: true,
      truncate: true,
      rawLeaves: true,
      flush: true
    })
    return transform
  }

  async utimes (atime, mtime) {
    try {
      await this.ipfs.files.touch(this.path, {
        mtime,
        flush: true
      })
    } catch {
      // This will fail on Kubo, and only on Kubo
    }
  }
}

async function collect (iterator) {
  const items = []
  for await (const item of iterator) {
    items.push(item)
  }
  return items
}

async function copyFromPath (ipfs, ipfsPath, destinationFolder) {
  const items = ipfs.ls(ipfsPath)
  for await (const { name } of items) {
    const fullIPFSPath = posix.join(ipfsPath, name)
    const fullMFSPath = posix.join(destinationFolder, name)
    await ipfs.files.cp(fullIPFSPath, fullMFSPath, {
      parents: true,
      flush: true
    })
  }
}
