-- Local delegation remains excluded from portable archives.
ALTER TABLE mallet_staff_grants ADD COLUMN collection_cents INTEGER NOT NULL DEFAULT 0 CHECK(collection_cents>=0);
ALTER TABLE mallet_staff_grants ADD COLUMN payroll_right INTEGER NOT NULL DEFAULT 0 CHECK(payroll_right IN (0,1));
