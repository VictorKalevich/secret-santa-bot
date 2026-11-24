// Texts of src/chat.js (060): chat between Santa and the giftee
export default {
  // "Too long" refusal for the letter, chat and support messages: {max} — MAX_CHARS
  'chat.tooLong': 'Muito longo: {n} caracteres, máximo {max} (limite de mensagem do Telegram).',
  'chat.empty': 'Mensagem vazia.',
  'chat.noWard': 'Você ainda não tem um presenteado.',
  'chat.noSanta': 'O sorteio ainda não foi feito para você.',
  'chat.pairChanged': 'O par mudou — atualize a tela.',
  'chat.pairChangedReply': '🔄 O par mudou depois que você tocou em “Responder” — a mensagem não foi enviada. Toque em “↩️ Responder” de novo.',
  // How the giftee sees Santa in bot messages: without a mask and with a mask (040)
  'chat.santaTitle': 'Seu Papai Noel secreto',
  'chat.santaTitleMask': 'Seu Papai Noel secreto “{mask}”',
  // Message to the other side: {santa} — chat.santaTitle*, {title} — event title, {text} — message text
  'chat.fromSanta': '💬 <b>{santa} ({title}) escreve:</b>\n\n{text}',
  'chat.fromWard': '💬 <b>Seu presenteado ({title}) escreve:</b>\n\n{text}',
  'chat.historyButton': '💬 Conversa completa',
};
