-- 0003_demo_request_verify: requesters must confirm their email before the team is alerted.

ALTER TABLE demo_request
  ADD COLUMN email_verified_at  timestamptz,
  ADD COLUMN verify_token_hash  text,
  ADD COLUMN verify_expires_at  timestamptz;

CREATE UNIQUE INDEX demo_request_verify_token_idx ON demo_request (verify_token_hash) WHERE verify_token_hash IS NOT NULL;

-- Requests saved before verification existed were already handled by the team.
UPDATE demo_request SET email_verified_at = created_at;
