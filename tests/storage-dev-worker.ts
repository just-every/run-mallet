import worker from './storage-worker'
import {withDevIdentity} from '../src/modules/operator-auth/dev/index.mjs'
import {authConfig} from '../src/auth.server'
export default withDevIdentity(worker,{config:authConfig})
