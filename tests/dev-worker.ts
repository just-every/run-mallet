// The real local identity wrapper used by rer dev, around the public Worker doors.
import worker from './worker'
import { withDevIdentity } from '../src/modules/operator-auth/dev/index.mjs'
import { authConfig } from '../src/auth.server'
export default withDevIdentity(worker, { config: authConfig })
