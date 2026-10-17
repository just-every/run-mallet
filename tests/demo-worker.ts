// The test Worker as `rer demo` runs it: Base's demo wrapper with Mallet's sample workshop.
import { withDemo } from '../src/modules/demo/index.mjs'
import worker from './worker'
import { seedDemo } from '../src/demo'
export default withDemo(worker, { seed: seedDemo })
