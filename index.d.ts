import type { IPFS } from 'ipfs-core-types'

export interface Diff {
  op: 'remove' | 'add' | 'change',
  path: string
}

export type SyncOptions = Partial<{
  root: string,
  noDelete: boolean,
  ignore: (change: Diff) => Promise<boolean>
}>

export default class MFSSync {
  constructor(ipfs: IPFS);
  fromFSToMFS(fromPath: string, toPath: string, syncOptions?: SyncOptions): AsyncIterable<Diff>;
  fromMFSToMFS(fromPath: string, toPath: string, syncOptions?: SyncOptions): AsyncIterable<Diff>;
  fromMFSToFS(fromPath: string, toPath: string, syncOptions?: SyncOptions): AsyncIterable<Diff>
  fromURLToMFS(url: string, toPath: string, syncOptions?: SyncOptions): AsyncIterable<Diff>
  fromURLToFS(url: string, toPath: string, syncOptions?: SyncOptions): AsyncIterable<Diff>
}
