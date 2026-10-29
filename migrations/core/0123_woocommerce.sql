-- Installation-local enabling authority never travels with historical orders.
CREATE TABLE IF NOT EXISTS mallet_woo_authority (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 connection_id TEXT NOT NULL,
 generation TEXT NOT NULL,
 origin TEXT NOT NULL,
 owner_id TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1))
);
