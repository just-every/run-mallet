CREATE TABLE mallet_records (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision > 0),
  value TEXT NOT NULL CHECK(json_valid(value)),
  PRIMARY KEY(kind,id)
);
CREATE TABLE mallet_meta (id INTEGER PRIMARY KEY CHECK(id = 1), version INTEGER NOT NULL);
INSERT INTO mallet_meta(id,version) VALUES(1,0);
CREATE TABLE mallet_assert (ok INTEGER NOT NULL CHECK(ok = 1));
CREATE TRIGGER mallet_insert AFTER INSERT ON mallet_records BEGIN
  UPDATE mallet_meta SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER mallet_update AFTER UPDATE ON mallet_records BEGIN
  UPDATE mallet_meta SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER mallet_delete AFTER DELETE ON mallet_records BEGIN
  UPDATE mallet_meta SET version=version+1 WHERE id=1;
END;
