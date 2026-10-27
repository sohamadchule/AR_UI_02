-- 0007_store_review: customer reviews on a client storefront.
-- Visitors submit them from the store page; they go live only once an admin approves.

CREATE TYPE store_review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE store_review (
  id          uuid                PRIMARY KEY DEFAULT uuidv7(),
  -- The storefront it belongs to: a Brand.slug from src/data/brands.ts.
  brand_slug  text                NOT NULL,
  name        text                NOT NULL,
  place       text,
  -- Which piece the review is about, as the visitor wrote it.
  piece       text,
  quote       text                NOT NULL,
  status      store_review_status NOT NULL DEFAULT 'pending',
  -- Demo text written for the storefront, not a real customer. Shown as approved; the admin can remove it.
  is_sample   boolean             NOT NULL DEFAULT false,
  created_at  timestamptz         NOT NULL DEFAULT now(),
  updated_at  timestamptz         NOT NULL DEFAULT now(),
  CONSTRAINT store_review_brand_len CHECK (char_length(brand_slug) BETWEEN 1 AND 60),
  CONSTRAINT store_review_name_len  CHECK (char_length(name)  BETWEEN 1 AND 80),
  CONSTRAINT store_review_place_len CHECK (place IS NULL OR char_length(place) <= 80),
  CONSTRAINT store_review_piece_len CHECK (piece IS NULL OR char_length(piece) <= 80),
  CONSTRAINT store_review_quote_len CHECK (char_length(quote) BETWEEN 10 AND 600)
);
CREATE INDEX store_review_brand_idx ON store_review (brand_slug, status, created_at DESC);

CREATE TRIGGER store_review_set_updated_at
  BEFORE UPDATE ON store_review
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The three demo reviews the Saaj storefront shipped with, so they show (and can be removed) like any other.
-- Newest first on the page, so the first one written gets the latest timestamp.
INSERT INTO store_review (brand_slug, name, place, piece, quote, status, is_sample, created_at) VALUES
  ('saaj', 'Ananya R.', 'C-Scheme, Jaipur', 'Mahal sofa',
   'We placed the sofa in our living room on the phone first. It looked a little long, so they made it 15 cm shorter. It arrived exactly right.',
   'approved', true, now() - interval '1 minute'),
  ('saaj', 'Kabir & Meera', 'Gurugram', 'Dining chairs',
   'I could check six dining chairs around our table before ordering. No guessing about the colour against our floor.',
   'approved', true, now() - interval '2 minutes'),
  ('saaj', 'Farah S.', 'Mumbai', 'Alcove wardrobe',
   'Our lift is narrow. They showed us the wardrobe’s real size and the doorway check before anything was cut.',
   'approved', true, now() - interval '3 minutes');
