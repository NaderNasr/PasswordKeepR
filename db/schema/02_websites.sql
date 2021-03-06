DROP TABLE IF EXISTS websites CASCADE;

CREATE TABLE websites (
  id SERIAL PRIMARY KEY NOT NULL,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  url VARCHAR(255) NOT NULL,
  -- NOT NULL PASSWORD fix
  password VARCHAR(255),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);
