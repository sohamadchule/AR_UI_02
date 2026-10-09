-- 0004_demo_request_phone: optional contact number on demo requests.

ALTER TABLE demo_request
  ADD COLUMN phone text,
  ADD CONSTRAINT demo_request_phone_len CHECK (phone IS NULL OR char_length(phone) BETWEEN 7 AND 20);
