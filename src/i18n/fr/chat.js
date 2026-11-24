// Texts of src/chat.js (060): chat between Santa and giftee
export default {
  // "Too long" refusal for the letter, chat and requests: {max} - MAX_CHARS
  'chat.tooLong': "Trop long : {n} caractères, maximum {max} (limite d'un message Telegram).",
  'chat.empty': "Message vide.",
  'chat.noWard': "Tu n'as pas encore de destinataire.",
  'chat.noSanta': "Le tirage au sort n'a pas encore eu lieu pour toi.",
  'chat.pairChanged': "La paire a changé — actualise l'écran.",
  'chat.pairChangedReply': "🔄 La paire a changé après l'appui sur « Répondre » — le message n'a pas été envoyé. Appuie à nouveau sur « ↩️ Répondre ».",
  // How the giftee sees Santa in bot messages: without and with a mask (040)
  'chat.santaTitle': "Ton Père Noël secret",
  'chat.santaTitleMask': "Ton Père Noël secret « {mask} »",
  // Message to the other side: {santa} - chat.santaTitle*, {title} - event title, {text} - message text
  'chat.fromSanta': "💬 <b>{santa} ({title}) t'écrit :</b>\n\n{text}",
  'chat.fromWard': "💬 <b>Ton destinataire t'écrit ({title}) :</b>\n\n{text}",
  'chat.historyButton': "💬 Toute la conversation",
};
