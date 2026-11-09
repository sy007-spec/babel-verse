-- Account features: favorites, private reading history and moderated reader comments.
CREATE TABLE IF NOT EXISTS favorites(user_id text NOT NULL REFERENCES users(id),work_id uuid NOT NULL REFERENCES works(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,work_id));
CREATE INDEX IF NOT EXISTS favorites_recent ON favorites(user_id,created_at DESC);
-- Only signed-in readers are recorded; one row per poem, cleared on request.
CREATE TABLE IF NOT EXISTS reading_history(user_id text NOT NULL REFERENCES users(id),work_id uuid NOT NULL REFERENCES works(id),first_read_at timestamptz NOT NULL DEFAULT now(),last_read_at timestamptz NOT NULL DEFAULT now(),read_count integer NOT NULL DEFAULT 1 CHECK(read_count>0),PRIMARY KEY(user_id,work_id));
CREATE INDEX IF NOT EXISTS reading_recent ON reading_history(user_id,last_read_at DESC);
CREATE TABLE IF NOT EXISTS comments(id uuid PRIMARY KEY,work_id uuid NOT NULL REFERENCES works(id),author_id text NOT NULL REFERENCES users(id),device text NOT NULL,body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000),status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','published','private','review','deleted')),created_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz);
CREATE INDEX IF NOT EXISTS comments_work ON comments(work_id,created_at DESC) WHERE status='published';
CREATE INDEX IF NOT EXISTS comments_author ON comments(author_id,created_at DESC);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_kind_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_kind_check CHECK(kind IN('work','version','tag','comment'));
INSERT INTO schema_versions(version) VALUES(2) ON CONFLICT DO NOTHING;
