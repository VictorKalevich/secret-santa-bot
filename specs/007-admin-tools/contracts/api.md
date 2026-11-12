# Contract: инструменты организатора (007)

Дополняет [005 events.md](../../005-events-history/contracts/events.md) и [006 api-changes.md](../../006-fixes/contracts/api-changes.md).

## Участник

| Action | Тело | Ответ / эффект |
|---|---|---|
| `event.get` | `{event}` | + `announcements[{id, text, created_at, author_name}]` (до 20, новые первыми); в `member` + `gift_received` |
| `ward.received` | `{event, received}` | отметка «подарок получен» в паре, где я — подопечный; 400 без Санты или в завершённом эвенте; первая отметка → сообщение Санте «🎉 Твой подопечный в эвенте «…» получил подарок!» |

## Админ

| Action | Тело | Ответ / эффект |
|---|---|---|
| `admin.announce` | `{event, text}` | 1–2000 символов; сообщение «📣 Объявление · «<эвент>»» всем зарегистрированным участникам; ответ `{count}`; 400 в завершённом эвенте |
| `admin.events.create` | `{title, from?, invite?}` | `from` — образец: копия параметров и исключений; `invite: true` — приглашение участников образца; 400 «Образец не найден» |
| `admin.game` | + `draw_auto_date`, `reveal_auto`, `finish_auto` | `draw_auto_date` после жеребьёвки → 400 «Дату автожеребьёвки после жеребьёвки не задать» (если меняется) |
| `admin.state` | `{event}` | + у участника `gift_received`, `ward_seen` (для Санты в жеребьёвке); + `settings.draw_auto_date`, `reveal_auto`, `finish_auto`, `draw_cancelable`; `exclusions` — только между участниками |
| `admin.draw.cancel` | `{event}` | отмена жеребьёвки (FR-708); 400 «Отменить нельзя: кто-то уже открыл подопечного или началась переписка» / «Жеребьёвка не проведена» / раскрыто / завершён |
| `admin.audit` | `{event?}` | `entries[{id, event_id, actor_name, action, details, created_at}]` — последние 100: по эвенту или общие (`event` не задан); доступен и для завершённого эвента |

## Бот (cron, ежедневно в `REMINDER_HOUR`)

| Условие | Действие |
|---|---|
| `draw_auto_date <= сегодня`, жеребьёвки нет | жеребьёвка; при неудаче — админам «⚠️ Автожеребьёвка «…» не прошла: <причины>», дата снимается |
| `reveal_auto`, проведена, не раскрыта, `event_date + 1 <= сегодня` | раскрытие |
| `finish_auto`, `event_date + 3 <= сегодня` | завершение |

## Журнал: коды действий

`event.create`, `event.settings`, `registration`, `invite.regen`, `participate`, `member.remove`, `member.insert`,
`exclusion.add`, `exclusion.del`, `draw`, `draw.auto`, `draw.auto.failed`, `draw.cancel`, `reveal`, `finish`, `reset`,
`event.delete`, `wishlist.view`, `announce`, `remind.unfilled`, `remind.santas`, `invite.from`, `transfer`,
`role.grant`, `role.revoke`, `owner.transfer`, `owner.link`.
