-- 0008_design_request: a shopper's own design of a piece, sent to the shop from its Craft page.
-- Each row is a lead: who designed what (colour per part), and how to reach them.

CREATE TYPE design_request_status AS ENUM ('new', 'contacted', 'closed');

CREATE TABLE design_request (
  id            uuid                  PRIMARY KEY DEFAULT uuidv7(),
  -- The storefront it was sent from: a Brand.slug from src/data/brands.ts.
  brand_slug    text                  NOT NULL,
  -- The catalogue variant designed on; kept as text below too, so a deleted product leaves a readable lead.
  variant_id    uuid                  REFERENCES product_variant (id) ON DELETE SET NULL,
  product_name  text                  NOT NULL,
  -- Part by part, main part first: [{ "part": "Plate top", "colour": "Red", "hex": "#B3261E" }].
  design        jsonb                 NOT NULL,
  -- The extra parts' colours as /view/<variant>?mix=<mix>, to reopen the design in 3D.
  mix           text,
  name          text                  NOT NULL,
  phone         text                  NOT NULL,
  city          text,
  note          text,
  status        design_request_status NOT NULL DEFAULT 'new',
  created_at    timestamptz           NOT NULL DEFAULT now(),
  updated_at    timestamptz           NOT NULL DEFAULT now(),
  CONSTRAINT design_request_brand_len   CHECK (char_length(brand_slug) BETWEEN 1 AND 60),
  CONSTRAINT design_request_product_len CHECK (char_length(product_name) BETWEEN 1 AND 120),
  CONSTRAINT design_request_design_type CHECK (jsonb_typeof(design) = 'array'),
  CONSTRAINT design_request_mix_len     CHECK (mix IS NULL OR char_length(mix) <= 80),
  CONSTRAINT design_request_name_len    CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT design_request_phone_len   CHECK (char_length(phone) BETWEEN 7 AND 20),
  CONSTRAINT design_request_city_len    CHECK (city IS NULL OR char_length(city) <= 80),
  CONSTRAINT design_request_note_len    CHECK (note IS NULL OR char_length(note) <= 600)
);
CREATE INDEX design_request_brand_idx ON design_request (brand_slug, created_at DESC);

CREATE TRIGGER design_request_set_updated_at
  BEFORE UPDATE ON design_request
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
