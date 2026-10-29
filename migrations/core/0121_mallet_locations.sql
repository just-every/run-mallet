-- Keep delegation installation-local while allowing one explicit location.
CREATE TABLE mallet_location_staff_grants (
 operator_id TEXT PRIMARY KEY, operator_version INTEGER NOT NULL, revision INTEGER NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('advisor','manager','purchaser','cashier','accountant')),
 location TEXT NOT NULL CHECK(length(trim(location))>0), discount_bps INTEGER NOT NULL CHECK(discount_bps BETWEEN 0 AND 10000),
 spend_cents INTEGER NOT NULL CHECK(spend_cents>=0), refund_cents INTEGER NOT NULL CHECK(refund_cents>=0),
 cost_right INTEGER NOT NULL CHECK(cost_right IN (0,1)), granted_by TEXT NOT NULL, owner_version INTEGER NOT NULL,
 revoked_at INTEGER
);
INSERT INTO mallet_location_staff_grants SELECT * FROM mallet_staff_grants;
-- A source rollback must not revive an obsolete standing grant.
DELETE FROM mallet_staff_grants;
