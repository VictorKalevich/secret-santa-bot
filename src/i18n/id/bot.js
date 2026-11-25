// Texts of src/bot.js (061): chat with the bot — sign-up, menu, links, chat replies and support requests, buttons.
// {title} — event title in quotes (HTML), {name} — a name (HTML, except button labels and button answers)
export default {
  // Asking for a name (with the name from Telegram — the name and buttons)
  'bot.name.prompt': 'Siapa namamu? Tulis namamu (dan nama belakang kalau perlu) — nama ini akan dilihat Santa-mu, pemilik, dan admin.',
  'bot.name.offer': 'Nama dalam permainan — <b>{name}</b>, seperti di Telegram. Nama ini akan dilihat Santa-mu, pemilik, dan admin. Mau nama lain? Tekan «✏️ Ubah nama» atau langsung tulis namanya.',
  'bot.name.ask': '✏️ Tulis namamu (dan nama belakang kalau perlu) dalam satu pesan — maksimal 40 karakter. Nama ini akan dilihat Santa-mu, pemilik, dan admin.',
  'bot.name.saved': 'Nama sudah disimpan. Kamu bisa mengubahnya di aplikasi: «Profil» → «✏️ Ubah nama».',
  'bot.name.rule': 'Tolong tulis nama sebagai teks biasa (maksimal 40 karakter).',
  'bot.name.join': '✅ Ikut sebagai {name}',
  'bot.name.continue': '✅ Lanjut sebagai {name}',
  'bot.name.edit': '✏️ Ubah nama',
  // Greeting before asking for a name
  'bot.hello': '🎄 Halo! Ini bot untuk bermain Secret Santa.',
  'bot.helloEvent': '🎄 Halo! Ini bot untuk bermain Secret Santa, {title}.',
  'bot.niceToMeet': 'Senang berkenalan, {name}! 🎉',
  'bot.createFirstEvent': 'Buat acara pertamamu di aplikasi — tautan undangan akan muncul di sana.',
  'bot.writeLetterFirst': 'Sekarang buka aplikasi dan tulis surat untuk Secret Santa-mu di acara {title}: apa yang ingin kamu terima, apa yang kamu suka, ukuran, dan apa yang pasti tidak kamu mau.',
  'bot.closedBot': '🎄 Ini bot tertutup untuk bermain Secret Santa. Untuk bergabung, minta tautan undangan ke sebuah acara.',
  'bot.cancelled': 'Dibatalkan.',
  // Invitation link
  'bot.invite.stale': 'Tautan undangan ini sudah tidak berlaku. Minta tautan baru.',
  'bot.invite.removed': 'Kamu telah dikeluarkan dari acara {title} — kamu tidak bisa kembali lewat tautan. Kalau ini keliru, hubungi pemilik atau admin.',
  'bot.invite.closed': 'Pendaftaran untuk acara {title} sudah ditutup. Pemilik atau admin bisa membukanya lagi.',
  'bot.invite.member': '🎄 Kamu sudah ikut dalam acara {title}.',
  'bot.invite.joined': '🎄 Kamu ikut acara {title}! Buka aplikasi dan tulis surat untuk Secret Santa-mu.',
  'bot.invite.requestPending': '⏳ Permintaan bergabung ke acara {title} sudah dikirim — tunggu keputusannya.',
  'bot.invite.requestSent': '⏳ Permintaan bergabung ke acara {title} terkirim. Aku akan mengabarimu setelah permintaan ini diproses.',
  // Bot owner link (/setup)
  'bot.ownerLink.used': 'Tautan pemilik sudah dipakai. Untuk mendapatkan yang baru, ganti ADMIN_SECRET lalu buka lagi halaman penyiapan.',
  'bot.ownerLink.hello': '👑 Kamu pemilik bot «Secret Santa»: kamu membuat acara dan menunjuk admin.',
  'bot.ownerLink.done': '👑 Sekarang kamu pemilik bot: acara dan admin ada di aplikasi.',
  // Former owner link (051) - no longer works (063)
  'bot.ownLink.gone': 'Tautan ini sudah tidak berlaku. Untuk ikut, minta tautan undangan ke sebuah acara.',
  // Menu
  'bot.menu.title': '🎄 <b>Secret Santa</b>',
  // No running events: can create events (063) - and cannot
  'bot.menu.noEventsCreate': 'Saat ini kamu tidak ikut acara apa pun yang sedang berlangsung. Buat acaramu sendiri di aplikasi atau minta tautan undangan ke sebuah acara.',
  'bot.menu.noEvents': 'Saat ini kamu tidak ikut acara apa pun yang sedang berlangsung. Minta tautan undangan ke sebuah acara.',
  'bot.menu.events': 'Acaramu:',
  'bot.menu.event': '• {title} — {letter}, {draw}',
  'bot.menu.letterFilled': 'surat ✅',
  'bot.menu.letterEmpty': 'surat kosong ✏️',
  'bot.menu.drawAhead': 'undian belum dilakukan',
  'bot.menu.wardAssigned': 'penerima kado sudah ditentukan 🎁',
  'bot.menu.awaitingInsert': 'menunggu dimasukkan ke undian',
  'bot.menu.finished': '📚 Acara yang sudah selesai: {n} — riwayatnya ada di aplikasi.',
  'bot.menu.botOwner': '👑 Kamu pemilik bot — acara dan admin ada di aplikasi.',
  'bot.menu.toWard': '💬 Ke penerima kado · {title}',
  'bot.menu.toSanta': '💬 Ke Santa · {title}',
  'bot.menu.notify': '🔔 Notifikasi',
  // Reply in a chat or a support request; {n} — message length limit
  'bot.reply.hint': 'Maksimal {n} karakter, dalam satu jam. Semua obrolan ada di aplikasi (tombol «💬»).\n\n/cancel — batal',
  'bot.reply.expired': '⌛ Waktu membalas sudah habis — pesan tidak terkirim. Tekan «↩️ Balas» sekali lagi dan kirim ulang pesannya.',
  'bot.reply.tooLong': '❌ Terlalu panjang: {n} karakter, maksimal {max}. Kirim yang lebih pendek atau /cancel.',
  'bot.reply.failed': '❌ {error}',
  'bot.reply.toWardSent': '✅ Terkirim ke penerima kado atas nama «Secret Santa».',
  'bot.reply.toSantaSent': '✅ Terkirim ke Santa-mu.',
  // "Write a message" hint
  'bot.reply.toWard': '✍️ Tulis pesan untuk penerima kado ({title}) — aku akan meneruskannya secara <b>anonim</b>, atas nama «Secret Santa».',
  'bot.reply.toSanta': '✍️ Tulis pesan untuk Santa-mu ({title}) — aku akan meneruskannya. Santa tahu siapa kamu, tapi kamu tidak tahu siapa dia.',
  // Support requests to organizers
  'bot.support.sent': '✅ Pesan terkirim. Balasannya akan datang ke sini.',
  'bot.support.adminsOnly': '❌ Hanya pemilik dan admin yang bisa membalas tiket.',
  'bot.support.answered': '✅ Terkirim ke peserta.',
  'bot.support.notSent': '❌ {error} Pesan tidak terkirim.',
  'bot.support.participant': 'peserta',
  'bot.support.ask': '✍️ Tulis pesan tentang acara ({title}) — aku akan meneruskannya. Jangan tulis siapa penerima kadomu.',
  'bot.support.takenAnswer': '🙋 Tiket ini milikmu',
  'bot.support.taken': '🙋 Sekarang kamu yang menangani tiket <b>{name}</b> ({title}). Balas lewat tombol di bawah atau di aplikasi.',
  'bot.support.someoneElse': 'orang lain',
  'bot.support.answer': '✍️ Tulis balasan untuk <b>{name}</b> (tiket, {title}).',
  'bot.support.answerTake': '✍️ Tulis balasan untuk <b>{name}</b> (tiket, {title}). Dengan membalas, kamu mengambil tiket ini.',
  // Join requests
  'bot.request.approvedAnswer': '✅ Diterima',
  'bot.request.rejectedAnswer': '❌ Ditolak',
  'bot.request.approved': '✅ Permintaan diterima: <b>{name}</b>, {title}.',
  'bot.request.rejected': '❌ Permintaan ditolak: <b>{name}</b>, {title}.',
  // Notices about the giftee letter changes; bot.notify.mode.<mode>
  'bot.notify.title': 'Notifikasi saat penerima kado mengubah suratnya (di semua acara).\nSekarang: <b>{mode}</b>',
  'bot.notify.saved': 'Tersimpan: {mode}',
  'bot.notify.mode.sound': '🔔 Dengan suara',
  'bot.notify.mode.silent': '🔕 Tanpa suara',
  'bot.notify.mode.off': '🚫 Jangan kirim',
  // /language — language choice; name — language name in that language
  'bot.lang.choose': '🌐 Pilih bahasa bot dan aplikasi:',
  'bot.lang.auto': 'Sesuai Telegram ({name})',
  'bot.lang.saved': 'Bahasa: {name}',
};
