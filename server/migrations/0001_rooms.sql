CREATE TABLE rooms (
  code TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  touched INTEGER NOT NULL
);
CREATE INDEX rooms_touched ON rooms(touched);
