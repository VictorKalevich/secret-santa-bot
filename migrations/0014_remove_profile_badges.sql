-- 043: применить после выката Worker без emoji.set. Имена хранятся отдельно.
UPDATE users SET emoji = '' WHERE emoji <> '';
