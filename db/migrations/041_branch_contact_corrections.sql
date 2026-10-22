-- Parent-facing contact corrections supplied by Mobsie Kids.
UPDATE branches
SET phone = '063 956 8733', updated_at = now()
WHERE lower(name) LIKE '%soshanguve%' OR lower(name) LIKE '%mamelodi%';

UPDATE branches
SET email = 'info@mobsiekids.co.za', updated_at = now()
WHERE lower(name) LIKE '%hebron%';

UPDATE branches
SET address = 'No 7347/2 Umkhangele Street, Soshanguve East, Thorntree View, 0164',
    city = 'Soshanguve', updated_at = now()
WHERE lower(name) LIKE '%soshanguve%2%' OR lower(slug) IN ('soshanguve-2', 'soshanguve-branch-2');

UPDATE branches
SET name = regexp_replace(name, 'sky city', 'Sky City', 'i'),
    city = 'Sky City', updated_at = now()
WHERE lower(name) LIKE '%sky city%' OR lower(slug) = 'sky-city';
