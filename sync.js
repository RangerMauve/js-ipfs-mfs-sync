import { posix } from 'path'
import { pipelinePromise } from 'streamx'

export const REMOVE = 'remove'
export const ADD = 'add'
export const CHANGE = 'change'

async function noIgnore (change) {
  return false
}

// Take either an FS-P
export async function * sync (fromFS, toFS, {
  root = '/',
  noDelete = false,
  ignore = noIgnore
} = {}
) {
  for await (const change of diff(fromFS, toFS, root)) {
    if (await ignore(change)) {
      continue
    }
    const fullPath = posix.join(root, change.path)
    if (change.op === ADD || change.op === CHANGE) {
      const file1 = await fromFS.open(fullPath, 'r')
      const file2 = await toFS.open(fullPath, 'w')

      await pipelinePromise(
        file1.createReadStream(),
        file2.createWriteStream()
      )

      if (toFS.flush) {
        await toFS.flush()
      }
      const { mtime, utime } = await fromFS.stat(fullPath)

      let time = mtime || utime
      if (time.secs) {
        time = new Date(time.secs)
      }

      await file2.utimes(utime, mtime)
    } else if (change.op === REMOVE) {
      if (noDelete) {
        continue
      }
      await toFS.rm(fullPath, { recursive: true, force: true })

      if (toFS.flush) {
        await toFS.flush()
      }
    } else {
      throw new Error(`Unknown Operation ${change.op} at ${change.path}`)
    }
    yield change
  }

  if (toFS.flush) {
    await toFS.flush()
  }
}

// Yield either add, remove, change
export async function * diff (fromFS, toFS, path = '/') {
  // Get entry at path
  const [fromStat, toStat] = await Promise.all([
    stat(fromFS, path),
    stat(toFS, path)
  ])

  // If from is a File
  // Check if to is a file
  // If to is not a file, emit a delete, emit an add (for the folder), return
  // Check mtime, if same, return (no change)

  if (!fromStat && toStat) {
    yield { op: REMOVE, path }
    return
  }
  if (fromStat && !toStat) {
    for await (const subpath of readDirRecursive(fromFS, path)) {
      console.log({ path, subpath })
      yield { op: ADD, path: subpath }
    }
  }
  if (fromStat.isFile()) {
    if (!toStat.isFile()) {
      throw new Error(`Can only diff files and directories. At ${path}`)
    }

    if (fromStat.mtimeMs !== toStat.mtimeMs) {
      // TODO: Check the contents before doing a change?
      yield { op: CHANGE, path }
    } else {
      // Same!
      return
    }
  }
  if (!fromStat.isDirectory()) {
    throw new Error(`Can only diff files and directories. At ${path}`)
  }

  if (fromStat.isDirectory()) {
    if (!toStat.isDirectory()) {
      yield { op: REMOVE, path }
      yield { op: ADD, path }
    }
  }

  // List entries at path on both sides
  const [fromEntries, toEntries] = await Promise.all([
    readDir(fromFS, path),
    readDir(toFS, path)
  ])

  // Iterate through from
  // Any that aren't in to, track as add recursive
  // If in to, try to diff, perform diff
  for (const fromEntry of fromEntries) {
    const subPath = posix.join(path, fromEntry.name)

    if (hasEntry(toEntries, fromEntry)) {
      // Exists in both sides, do a diif on the subfolder
      yield * diff(fromFS, toFS, subPath)
    } else {
      if (fromEntry.isDirectory()) {
        for await (const subSubPath of readDirRecursive(fromFS, subPath)) {
          yield { op: ADD, path: subSubPath }
        }
      } else {
        yield { op: ADD, path: subPath }
      }
    }
  }

  // Iterate through to
  // If not in from, delete
  for (const toEntry of toEntries) {
    const subPath = posix.join(path, toEntry.name)
    if (!hasEntry(fromEntries, toEntry)) {
      yield { op: REMOVE, path: subPath }
    }
  }
}

function hasEntry (list, entry) {
  return list.find((existing) => entry.name === existing.name)
}

async function readDir (fs, folder) {
  return fs.readdir(folder, { withFileTypes: true })
}

async function * readDirRecursive (fs, folder) {
  for (const entry of await readDir(fs, folder)) {
    if (entry.isDirectory()) {
      yield * await readDirRecursive(fs, posix.join(folder, entry.name))
    } else {
      yield posix.join(folder, entry.name)
    }
  }
}

async function stat (fs, path) {
  try {
    return await fs.stat(path)
  } catch {
    return null
  }
}
