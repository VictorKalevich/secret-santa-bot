-- 040: маска Санты в переписке (pairs.mask — маска из набора src/looks.js или пусто, своя у пары в событии). Только
-- добавляет колонку (у всех пар — пусто) и поднимает версию схемы: код 040 её требует, прежний код с ней работает
-- (требует не ниже 13).

ALTER TABLE pairs ADD COLUMN mask TEXT NOT NULL DEFAULT '';

INSERT INTO settings (key, value) VALUES ('schema', '14')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
