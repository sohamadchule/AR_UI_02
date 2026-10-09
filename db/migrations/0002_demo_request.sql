-- 0002_demo_request: inbound "Request a demo" submissions from the website.

CREATE TYPE demo_request_status AS ENUM ('new', 'contacted', 'closed');

CREATE TABLE demo_request (
  id          uuid                PRIMARY KEY DEFAULT uuidv7(),
  name        text                NOT NULL,
  email       text                NOT NULL,
  company     text                NOT NULL,
  role        text,
  interest    text,
  message     text,
  status      demo_request_status NOT NULL DEFAULT 'new',
  -- false when the confirmation mail was suppressed (repeat request) or failed to send.
  confirmation_sent boolean       NOT NULL DEFAULT false,
  created_at  timestamptz         NOT NULL DEFAULT now(),
  updated_at  timestamptz         NOT NULL DEFAULT now(),
  CONSTRAINT demo_request_name_len    CHECK (char_length(name)    BETWEEN 1 AND 120),
  CONSTRAINT demo_request_email_len   CHECK (char_length(email)   BETWEEN 3 AND 254),
  CONSTRAINT demo_request_company_len CHECK (char_length(company) BETWEEN 1 AND 160),
  CONSTRAINT demo_request_message_len CHECK (message IS NULL OR char_length(message) <= 2000)
);
CREATE INDEX demo_request_created_idx ON demo_request (created_at DESC);
CREATE INDEX demo_request_email_idx   ON demo_request (email, created_at DESC);

CREATE TRIGGER demo_request_set_updated_at
  BEFORE UPDATE ON demo_request
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
