// Texts of src/chat.js (061, German): chat between Santa and giftee
export default {
  // "Too long" refusal for the wish list, chat and requests: {max} - MAX_CHARS
  'chat.tooLong': 'Zu lang: {n} Zeichen, maximal {max} (Grenze einer Telegram-Nachricht).',
  'chat.empty': 'Leere Nachricht.',
  'chat.noWard': 'Du hast noch kein Wichtelkind.',
  'chat.noSanta': 'Für dich hat die Auslosung noch nicht stattgefunden.',
  'chat.pairChanged': 'Das Paar hat sich geändert – aktualisiere die Ansicht.',
  'chat.pairChangedReply': '🔄 Das Paar hat sich nach dem Tippen auf «Antworten» geändert – die Nachricht wurde nicht gesendet. Tippe noch einmal auf «↩️ Antworten».',
  // How the giftee sees Santa in bot messages: without and with a mask (040)
  'chat.santaTitle': 'Dein Wichtel',
  'chat.santaTitleMask': 'Dein Wichtel «{mask}»',
  // Message to the other side: {santa} - chat.santaTitle*, {title} - round title, {text} - message text
  'chat.fromSanta': '💬 <b>{santa} ({title}) schreibt:</b>\n\n{text}',
  'chat.fromWard': '💬 <b>Dein Wichtelkind ({title}) schreibt dir:</b>\n\n{text}',
  'chat.historyButton': '💬 Ganzer Chat',
};
