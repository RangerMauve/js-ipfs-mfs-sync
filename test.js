import { createInMemoryIPFS } from 'ipfs-in-memory-repo'
import test from 'tape'
import delay from 'delay'

import { diff, sync } from './sync.js'
import { IPFSFS } from './ipfs-fs.js'
import { ScopedFS } from './scoped-fs.js'

const IPFS_URL_PREFIX = 'ipfs://'

const ipfs = await createInMemoryIPFS()

let counter = 0

async function next (autoMake = true) {
  const folder = `/example-${counter++}/`
  if (autoMake) {
    await ipfs.files.mkdir(folder, { flush: true })
  }
  return folder
}

test.onFinish(() => {
  ipfs.stop()
})

test('Diff two IPFS folders, IPFS-FS sanity check', async (t) => {
  const folder1 = await next()
  const folder2 = await next()
  const file = '/example.txt'
  const content = 'Hello World!'

  const fs1 = new IPFSFS(ipfs, folder1)
  const fs2 = new IPFSFS(ipfs, folder2)

  t.ok(fs1, 'Able to initialize')

  const file1 = await fs1.open(file)

  t.ok(file1, 'Able to open file handle')
  const writeStream = file1.createWriteStream()

  t.ok(writeStream, 'Able to create write stream')

  await writeToStream(writeStream, Buffer.from(content))

  await delay(100)

  t.pass('Wrote to fs')

  const changes = await collect(diff(fs1, fs2))
  const expectedChanges = [{ op: 'add', path: file }]

  t.deepEqual(changes, expectedChanges, 'Got expected diff')
})

test('Diff two scoped filesystems', async (t) => {
  const folder1 = './example/'
  const folder2 = './example2/'

  const fs1 = new ScopedFS(folder1)
  const fs2 = new ScopedFS(folder2)

  const changes = await collect(diff(fs1, fs2))
  const expectedChanges = [
    { op: 'add', path: '/example.txt' },
    { op: 'add', path: '/subfolder/example.txt' },
    { op: 'remove', path: '/example2.txt' }
  ]

  t.deepEqual(changes, expectedChanges, 'Got expected diff')
})

test('Diff between MFS and scoped fs', async (t) => {
  const folder1 = './example/'
  const folder2 = await next()

  const fs1 = new ScopedFS(folder1)

  const fs2 = await makeFsFromMap({
    'example2.txt': 'Goodbye World!'
  }, folder2)

  const changes = await collect(diff(fs1, fs2))
  const expectedChanges = [
    { op: 'add', path: '/example.txt' },
    { op: 'add', path: '/subfolder/example.txt' },
    { op: 'remove', path: '/example2.txt' }
  ]

  t.deepEqual(changes, expectedChanges, 'Got expected diff')
})

test.only('Sync from one mfs to another', async (t) => {
  const folder1 = await next()
  const folder2 = await next()

  const file = '/example.txt'
  const content = 'Hello World!'

  const fs1 = await makeFsFromMap({ 'example.txt': content }, folder1)
  const fs2 = new IPFSFS(ipfs, folder2)

  const changes = await collect(sync(fs1, fs2))
  const expectedChanges = [{ op: 'add', path: file }]

  t.deepEqual(changes, expectedChanges, 'Got expected diff')

  const listings = await fs2.readdir('/')

  t.deepEqual(listings, ['example.txt'], 'File got added')

  const noChanges = await collect(sync(fs1, fs2))

  t.deepEqual(noChanges, [], 'No changes detected after sync')
})

async function collect (iterator) {
  const chunks = []
  for await (const chunk of iterator) {
    chunks.push(chunk)
  }
  return chunks
}

async function writeToStream (writeStream, data) {
  writeStream.write(data)
  await new Promise((resolve, reject) => {
    writeStream.end((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function makeFsFromMap (files, destination = null) {
  const ipfsURL = await makeIPFSURLFromMap(files)
  return IPFSFS.fromURL(ipfs, ipfsURL, destination)
}

async function makeIPFSURLFromMap (files) {
  const toAdd = Object.entries(files).map(([path, content]) => {
    return {
      path,
      content,
      mtime: new Date()
    }
  })

  const results = await collect(ipfs.addAll(toAdd, {
    cidVersion: 1,
    rawLeaves: true,
    wrapWithDirectory: true
  }))

  const directory = results.at(-1)

  const url = `${IPFS_URL_PREFIX}${directory.cid}/`

  return url
}

/*
async function makeIPNSURLFromMap (files, name) {
  const ipfsURL = await makeIPFSURLFromMap(files)
  const ipfsPath = ipfsURL.replace(IPFS_URL_PREFIX, '/ipfs/')

  const { id } = await ipfs.key.gen(name)

  await ipfs.name.publish(ipfsPath, {
    resolve: true,
    name
  })

  return `ipns://${id}/`
}
*/
