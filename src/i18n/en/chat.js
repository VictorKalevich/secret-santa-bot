// Texts of src/chat.js (061, English): Santa and giftee chat
export default {
  // "Too long" refusal for the letter, chat and support requests: {max} — MAX_CHARS
  'chat.tooLong': 'Too long: {n} characters, max {max} (Telegram message limit).',
  'chat.empty': 'Empty message.',
  'chat.noWard': 'You don’t have a giftee yet.',
  'chat.noSanta': 'The draw hasn’t happened for you yet.',
  'chat.pairChanged': 'The pair has changed — refresh the screen.',
  'chat.pairChangedReply': '🔄 The pair changed after you tapped “Reply” — the message wasn’t sent. Tap “↩️ Reply” again.',
  // How the giftee sees Santa in bot messages: without a mask and with one (040)
  'chat.santaTitle': 'Your Secret Santa',
  'chat.santaTitleMask': 'Your Secret Santa “{mask}”',
  // Message to the other side: {santa} — chat.santaTitle*, {title} — event name, {text} — message text
  'chat.fromSanta': '💬 <b>{santa} ({title}) writes:</b>\n\n{text}',
  'chat.fromWard': '💬 <b>Your giftee ({title}) writes:</b>\n\n{text}',
  'chat.historyButton': '💬 Whole chat',
};
