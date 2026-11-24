-- 057: сверка отметок уведомлений после выката кода 057 (specs/057-cron-marks/quickstart.md) и после возврата к нему с
-- прежней версии. Прежний код принимает правки писем и адресов без отметки members.notify_at — правка, сделанная между
-- миграцией 0020 и выкатом, осталась бы без уведомления Санте. Отмечает подопечных с неучтённой правкой в идущем событии —
-- тот же оператор, что в 0020_cron_marks.sql. Схему не меняет; повтор ничего не меняет.
-- npx wrangler d1 execute <база> [--env second] --remote --file tools/notify-reconcile.sql

UPDATE members SET notify_at = MAX(wishlist_updated_at, delivery_updated_at)
 WHERE EXISTS (SELECT 1 FROM pairs p JOIN events e ON e.id = p.event_id
                WHERE p.event_id = members.event_id AND p.ward = members.user_id AND e.status = 'active'
                  AND p.notified_at < MAX(members.wishlist_updated_at, members.delivery_updated_at));
