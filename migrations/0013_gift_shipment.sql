ALTER TABLE pairs ADD COLUMN gift_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pairs ADD COLUMN sent_date TEXT NOT NULL DEFAULT '';
ALTER TABLE pairs ADD COLUMN carrier TEXT NOT NULL DEFAULT '';
ALTER TABLE pairs ADD COLUMN tracking TEXT NOT NULL DEFAULT '';
ALTER TABLE pairs ADD COLUMN shipment_version TEXT NOT NULL DEFAULT '';
UPDATE pairs SET shipment_version = lower(hex(randomblob(16)));
CREATE TRIGGER shipment_initial_version AFTER INSERT ON pairs
WHEN NEW.shipment_version = ''
BEGIN
  UPDATE pairs SET shipment_version = lower(hex(randomblob(16)))
    WHERE event_id = NEW.event_id AND santa = NEW.santa;
END;
UPDATE settings SET value = '16' WHERE key = 'schema';
