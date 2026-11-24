// Texts of src/chat.js (061): chat between Santa and giftee
export default {
  // "Too long" for letter, chat and support requests: {max} — MAX_CHARS
  'chat.tooLong': 'Terlalu panjang: {n} karakter, maksimal {max} (batas pesan Telegram).',
  'chat.empty': 'Pesan kosong.',
  'chat.noWard': 'Kamu belum punya penerima kado.',
  'chat.noSanta': 'Undian untukmu belum dilakukan.',
  'chat.pairChanged': 'Pasangan berubah — muat ulang layar.',
  'chat.pairChangedReply': '🔄 Pasangan berubah setelah kamu menekan «Balas» — pesan tidak terkirim. Tekan «↩️ Balas» sekali lagi.',
  // How the giftee sees Santa in bot messages: without and with a mask
  'chat.santaTitle': 'Secret Santa-mu',
  'chat.santaTitleMask': 'Secret Santa-mu «{mask}»',
  // Message to the other side: {santa} — chat.santaTitle*, {title} — event title, {text} — message
  'chat.fromSanta': '💬 <b>{santa} ({title}) menulis:</b>\n\n{text}',
  'chat.fromWard': '💬 <b>Penerima kadomu menulis ({title}):</b>\n\n{text}',
  'chat.historyButton': '💬 Semua obrolan',
};
