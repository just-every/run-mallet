import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { Hero } from './Hero'
import { Sections } from './Sections'
import '../../../public/brand/tokens.css'
import '../shell/shell.css'
import '../shell/pegboard.css'
import './landing.css'

/** Mallet's homepage on the run site: the pegboard hero, seven bands and the closing call, all static. */
export function Landing() {
  return (
    <>
      <SiteHeader />
      <main><Hero /><Sections /></main>
      <SiteFooter />
    </>
  )
}
