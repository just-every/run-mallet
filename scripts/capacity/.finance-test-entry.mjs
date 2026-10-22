import {test} from 'node:test'
import {run} from '../../tests/harness.mjs'
import {capacityImportJourney} from '../../tests/support/capacity-import-journey.mjs'
import {estimatePricingJourney} from '../../tests/support/estimate-pricing-journey.mjs'
import {refundsJourney,stripeRefundJourney} from '../../tests/support/refunds-journey.mjs'
import {providerJobsJourney} from '../../tests/support/provider-jobs-journey.mjs'
import {supplementJourney} from '../../tests/support/supplement-journey.mjs'
import {customersJourney} from '../../tests/support/customers-journey.mjs'
test('bounded native capacity graph restore',capacityImportJourney)
test('frozen pricing archive',()=>run(estimatePricingJourney))
test('refund and account-credit archive',refundsJourney)
test('Stripe redirects preserve frozen invoices through archive',stripeRefundJourney)
test('provider job archive keeps fresh authority',providerJobsJourney)
test('frozen customer billing survives mutable account changes',()=>run(customersJourney))
test('prospective replacement scope and frozen original invoice archive',supplementJourney)
