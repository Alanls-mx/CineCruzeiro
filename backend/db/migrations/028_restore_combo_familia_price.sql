UPDATE concessions
SET price = 42.00,
    updated_at = now()
WHERE id = 'combo-familia'
  AND price = 1.00;
