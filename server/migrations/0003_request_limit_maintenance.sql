CREATE TABLE request_limit_maintenance (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_window INTEGER NOT NULL
);
