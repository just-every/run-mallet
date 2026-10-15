// Product records, exact import originals and approvals are portable. Identity and
// credential material are excluded; a fresh installation claims its own owner.
export default {
 product:'workshop/mallet',
 excludeTables:['mallet_agent_keys','mallet_assert'],
 replaceableTables:['mallet_meta'],
 requiredConfiguration:['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
};
