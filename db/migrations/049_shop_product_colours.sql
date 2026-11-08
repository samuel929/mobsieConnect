ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS colors text[] NOT NULL DEFAULT '{}';

ALTER TABLE shop_order_items
  ADD COLUMN IF NOT EXISTS selected_color text;

UPDATE shop_products
SET colors = ARRAY['Red','Orange','Yellow','Green','Blue','Purple','Pink']
WHERE cardinality(colors)=0 AND lower(name) ~ '(seven|7)[[:space:]]+colou?rs?';
