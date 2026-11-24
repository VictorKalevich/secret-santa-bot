// Texts of src/chat.js (060): chat between Santa and giftee
export default {
  // "Too long" refusal for the letter, chat and tickets: {max} - MAX_CHARS
  'chat.tooLong': "Troppo lungo: {n} caratteri, massimo {max} (limite dei messaggi di Telegram).",
  'chat.empty': "Messaggio vuoto.",
  'chat.noWard': "Non hai ancora un destinatario.",
  'chat.noSanta': "Il sorteggio per te non è ancora stato fatto.",
  'chat.pairChanged': "La coppia è cambiata: aggiorna la schermata.",
  'chat.pairChangedReply': "🔄 La coppia è cambiata dopo che hai toccato «Rispondi»: il messaggio non è stato inviato. Tocca di nuovo «↩️ Rispondi».",
  // How the giftee sees Santa in bot messages: without and with a mask (040)
  'chat.santaTitle': "Il tuo Babbo Natale segreto",
  'chat.santaTitleMask': "Il tuo Babbo Natale segreto «{mask}»",
  // Message to the other side: {santa} - chat.santaTitle*, {title} - event title, {text} - message text
  'chat.fromSanta': "💬 <b>{santa} ({title}) scrive:</b>\n\n{text}",
  'chat.fromWard': "💬 <b>Ti scrive il tuo destinatario ({title}):</b>\n\n{text}",
  'chat.historyButton': "💬 Tutta la chat",
};
