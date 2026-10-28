// Product records, exact import originals and approvals are portable. Identity and
// credential material are excluded; a fresh installation claims its own owner.
import {explainErasureFreshness} from './restore/notice.mjs'
import {validateStaged} from './restore/validate-staged.mjs'
import {validateAndQuarantineJobs} from './restore/validate-jobs.mjs'
import {validateSearchProjection} from './read-model/search-projection.mjs'
import {PortabilityError} from '@runeditrun/rer/modules/portability/storage'

async function validateArchive(staged) {
 try {
  await validateStaged(staged)
  await validateSearchProjection(staged.db,staged.tables)
  await validateAndQuarantineJobs(staged)
 } catch(error) {
  if(error instanceof PortabilityError)throw error
  throw new PortabilityError('mallet_graph:staged_validation',409)
 }
 return explainErasureFreshness()
}
export default {
 product:'workshop/mallet',
 validateStaged:validateArchive,
 excludeTables:['mallet_location_staff_grants','mallet_api_clients','mallet_api_requests','mallet_assistant_keys','mallet_webhook_authority','mallet_status_authority','mallet_review_tokens','mallet_review_authority','mallet_saml_transactions','mallet_saml_sessions','mallet_enterprise_connections','mallet_enterprise_users','mallet_booking_reminder_tokens','mallet_outreach_authority','mallet_report_schedules','mallet_import_audit_context','mallet_staff_grants','mallet_retention_clock','mallet_booking_tokens','mallet_checkin_links','mallet_portal_tokens','mallet_portal_requests','mallet_intake_form_links','mallet_intake_secrets','mallet_agent_keys','mallet_customer_links','mallet_approval_links','mallet_approval_reminder_tokens','mallet_assert','mallet_auth_policy','mallet_factors','mallet_totp_pending','mallet_recovery_codes','mallet_session_proofs','mallet_auth_challenges','mallet_rate','mallet_connector_secrets'],
 replaceableTables:['mallet_meta'],
 requiredConfiguration:['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
};
