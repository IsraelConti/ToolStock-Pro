CREATE TABLE IF NOT EXISTS google_play_licenses (
 google_sub TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 purchase_token_hash TEXT NOT NULL UNIQUE,
 purchase_token_cipher TEXT NOT NULL,
 subscription_state TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE google_play_licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS google_play_license_owner ON google_play_licenses;
CREATE POLICY google_play_license_owner ON google_play_licenses
 USING (google_sub = current_setting('app.google_sub', true))
 WITH CHECK (google_sub = current_setting('app.google_sub', true));
