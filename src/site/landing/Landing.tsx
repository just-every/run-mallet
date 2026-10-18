import { SiteFooter } from '../shell/SiteFooter'
import { Hero } from './Hero'
import { Approve } from './sections/Approve'
import { Board } from './sections/Board'
import { CheckIn } from './sections/CheckIn'
import { Closing } from './sections/Closing'
import { Day } from './sections/Day'
import { FollowUp } from './sections/FollowUp'
import { Inspect } from './sections/Inspect'
import { Interlude } from './sections/Interlude'
import { MovingIn } from './sections/MovingIn'
import { Parts } from './sections/Parts'
import { Pickup } from './sections/Pickup'
import { Week } from './sections/Week'
import '../styles/site.css'
import '../styles/ui.css'
import '../styles/hero.css'
import '../styles/morning.css'
import '../styles/afternoon.css'
import '../styles/after.css'

/** Mallet's homepage: one repair order, RO 4127, from drop-off to pickup, then the shop past the car (desk page-s1). */
export function Landing() {
  return (
    <>
      <main>
        <Hero />
        <Day />
        <CheckIn />
        <Inspect />
        <Approve />
        <Parts />
        <Board />
        <Pickup />
        <Interlude />
        <FollowUp />
        <Week />
        <MovingIn />
        <Closing />
      </main>
      <SiteFooter />
    </>
  )
}
