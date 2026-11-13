-- 014: закреплённые пары владельца «кто кому дарит». Только добавляет таблицу; данные не меняет.

-- У Санты не больше одного закреплённого подопечного (первичный ключ), у подопечного — не больше одного закреплённого
-- Санты (уникальный индекс). Видит и меняет только владелец бота, только до жеребьёвки.
CREATE TABLE IF NOT EXISTS fixed_pairs (
  event_id INTEGER NOT NULL,
  giver INTEGER NOT NULL,
  receiver INTEGER NOT NULL,
  PRIMARY KEY (event_id, giver)
);

CREATE UNIQUE INDEX IF NOT EXISTS fixed_pairs_receiver ON fixed_pairs (event_id, receiver);

INSERT INTO settings (key, value) VALUES ('schema', '11')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
