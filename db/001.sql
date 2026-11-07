CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY, name text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS works(id uuid PRIMARY KEY, author_id text NOT NULL REFERENCES users(id), title text NOT NULL, poet text NOT NULL, language text NOT NULL, period text NOT NULL DEFAULT '', genre text NOT NULL DEFAULT '', body text NOT NULL, fingerprint text NOT NULL UNIQUE, source_url text NOT NULL, citation text NOT NULL, rights text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','published','private','review')), evidence text, evidence_by text, evidence_at timestamptz, created_at timestamptz DEFAULT now());
CREATE INDEX IF NOT EXISTS works_title_trgm ON works USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS works_body_trgm ON works USING gin(body gin_trgm_ops);
ALTER TABLE works ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS works_search_trgm ON works USING gin(search_text gin_trgm_ops);
CREATE TABLE IF NOT EXISTS translations(id uuid PRIMARY KEY, work_id uuid NOT NULL REFERENCES works(id), author_id text NOT NULL REFERENCES users(id), device text NOT NULL, language text NOT NULL, ai_use text NOT NULL CHECK(ai_use IN('human','assisted','generated')), mirror_consent boolean NOT NULL, commercial_consent boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), UNIQUE(work_id,author_id,language), UNIQUE(work_id,device,language));
CREATE TABLE IF NOT EXISTS versions(id uuid PRIMARY KEY, translation_id uuid NOT NULL REFERENCES translations(id), body text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','published','private','review')), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS votes(id uuid PRIMARY KEY, translation_id uuid NOT NULL REFERENCES translations(id), version_id uuid NOT NULL REFERENCES versions(id), author_id text NOT NULL REFERENCES users(id), device text NOT NULL, score integer NOT NULL CHECK(score BETWEEN 1 AND 5), excluded boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), UNIQUE(translation_id,author_id), UNIQUE(translation_id,device));
CREATE TABLE IF NOT EXISTS tags(id uuid PRIMARY KEY, work_id uuid NOT NULL REFERENCES works(id), author_id text NOT NULL REFERENCES users(id), device text NOT NULL, labels jsonb NOT NULL, reason text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','published','private','review')), created_at timestamptz DEFAULT now(), UNIQUE(work_id,author_id), UNIQUE(work_id,device));
CREATE TABLE IF NOT EXISTS jobs(id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN('work','version','tag')), target uuid NOT NULL, state text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, result jsonb, created_at timestamptz DEFAULT now(), UNIQUE(kind,target));
CREATE TABLE IF NOT EXISTS audit(id bigserial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, target text NOT NULL, reason text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS schema_versions(version integer PRIMARY KEY, installed_at timestamptz DEFAULT now());
CREATE OR REPLACE FUNCTION immutable_text() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.body IS DISTINCT FROM OLD.body THEN RAISE EXCEPTION 'immutable body'; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS immutable_version ON versions;
CREATE TRIGGER immutable_version BEFORE UPDATE ON versions FOR EACH ROW EXECUTE FUNCTION immutable_text();
CREATE OR REPLACE FUNCTION immutable_vote() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable vote'; END IF;
 IF (NEW.score,NEW.version_id,NEW.translation_id,NEW.author_id,NEW.device) IS DISTINCT FROM (OLD.score,OLD.version_id,OLD.translation_id,OLD.author_id,OLD.device) THEN RAISE EXCEPTION 'immutable vote'; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS immutable_vote ON votes;
CREATE TRIGGER immutable_vote BEFORE UPDATE OR DELETE ON votes FOR EACH ROW EXECUTE FUNCTION immutable_vote();
INSERT INTO schema_versions(version) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS collections(id text PRIMARY KEY,title text NOT NULL,input_sha256 text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS collection_entries(collection_id text NOT NULL REFERENCES collections(id),number integer NOT NULL CHECK(number>0),work_id uuid NOT NULL REFERENCES works(id),episode integer,PRIMARY KEY(collection_id,number),UNIQUE(collection_id,work_id));
