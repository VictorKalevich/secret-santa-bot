// Texts of app part 04-settings (063): the "Settings" screen - profile, language, notifications, "About the bot" and the
// "Bot owner" section (all events, who can create events, bot log, passing the rights)
export default {
  'app.settings.title': 'Pengaturan',
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': 'Profil',
  'app.settings.profile.editName': '✏️ Ubah nama',
  'app.settings.name.title': 'Namamu',
  'app.settings.name.hint': 'Namamu sama di semua acara. Nama ini dilihat pemilik, admin, dan Santa-mu, dan saat rahasia terungkap — juga penerima kadomu.',
  'app.settings.name.empty': 'Tulis nama',
  'app.settings.name.saved': 'Nama tersimpan',
  // Bot and app language; name — language name in that language
  'app.settings.lang.button': '🌐 Bahasa',
  'app.settings.lang.auto': 'Sesuai Telegram ({name})',
  'app.settings.lang.hint': 'Bot dan aplikasi akan memakai bahasa ini. «Sesuai Telegram» — bahasa Telegram-mu.',
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': 'Notifikasi',
  'app.settings.notify.sound': '🔔 Suara',
  'app.settings.notify.silent': '🔕 Senyap',
  'app.settings.notify.off': '🚫 Mati',
  'app.settings.notify.hint': 'Berlaku untuk pesan «penerima kado mengubah suratnya» dan «kado sudah dikirim».',
  // "About the bot": how it works (items - app.event.how.*)
  'app.settings.about': 'Tentang bot',
  // Bot owner section
  'app.settings.bot.title': 'Pemilik bot',
  'app.settings.bot.events': '🗂 Semua acara',
  'app.settings.bot.creators': '✍️ Siapa yang bisa membuat acara',
  'app.settings.bot.log': '📜 Log bot',
  'app.settings.bot.pass': '👑 Serahkan hak pemilik bot',
  // "All events": newest first, 50 at a time; {owner} - the event owner's name, {n} - participants
  'app.settings.events.title': 'Semua acara',
  'app.settings.events.about': 'Pemilik: {owner} · peserta: {n}',
  'app.settings.events.more': 'Tampilkan lebih banyak',
  'app.settings.events.empty': 'Belum ada acara.',
  // "Who can create events" (closed bot)
  'app.settings.creators.title': 'Siapa yang bisa membuat acara',
  'app.settings.creators.hint': 'Acara bisa dibuat olehmu dan orang yang kamu izinkan. Pembuat acara menjadi pemiliknya.',
  'app.settings.creators.empty': 'Belum ada orang lain di bot.',
  'app.settings.creators.on': '«{name}» sekarang bisa membuat acara',
  'app.settings.creators.off': '«{name}» tidak bisa membuat acara lagi',
  // Passing the bot owner rights
  'app.settings.pass.title': 'Hak pemilik bot',
  'app.settings.pass.hint': 'Pemilik bot hanya satu: dia melihat semua acara dan memindahkan keikutsertaan ke akun baru. Acaramu tetap milikmu.',
  'app.settings.pass.choose': 'Serahkan ke siapa…',
  'app.settings.pass.empty': 'Belum ada orang yang bisa menerima hak ini.',
  'app.settings.pass.confirm': 'Serahkan hak pemilik bot ke «{name}»? Acaramu tetap milikmu, tapi kamu tidak akan lagi melihat acara orang lain dan log bot.',
  'app.settings.pass.done': '👑 Hak pemilik bot diserahkan',
};
