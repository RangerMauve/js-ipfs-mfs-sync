# js-ipfs-mfs-sync
Synchronize between MFS and the filesystem, pull or push

```javascript
import MFSSync from 'ipfs-mfs-sync'
import IPFS from 'ipfs-core'

const ipfs = await IPFS.create()

const sync = new MFSSync(ipfs)

for(const {op, path} of sync.fromFSToMFS('./example', '/mfs-folder')) {
  if(op == 'remove') {
    console.log('Removed file:', path)
  }
}
```
