-- Dedicated SERPER_DB. Never delete reservations when clearing cached content.
CREATE TABLE IF NOT EXISTS discovery_sessions (
  id TEXT PRIMARY KEY, spec TEXT NOT NULL, query TEXT NOT NULL,
  next_page INTEGER NOT NULL DEFAULT 1, seen TEXT NOT NULL DEFAULT '[]',
  expires INTEGER NOT NULL, ended INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS discovery_requests (
  session TEXT NOT NULL, page INTEGER NOT NULL, time INTEGER NOT NULL,
  day TEXT NOT NULL, month TEXT NOT NULL, charged INTEGER NOT NULL,
  response TEXT, status INTEGER,
  PRIMARY KEY (session, page)
);
CREATE INDEX IF NOT EXISTS discovery_day ON discovery_requests(day, charged);
CREATE INDEX IF NOT EXISTS discovery_month ON discovery_requests(month, charged);
CREATE TABLE IF NOT EXISTS discovery_cache (
  key TEXT PRIMARY KEY, body TEXT NOT NULL, expires INTEGER NOT NULL
);
