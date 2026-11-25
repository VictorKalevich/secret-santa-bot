// Texts of src/events.js (061): creation, finishing, deletion, reset, invitations, reveal, reminders,
// announcements, event parameters
export default {
  'events.titleRule': 'Nama acara harus 1 sampai 80 karakter.',
  // Creating (063): who can and the limit; {limit} - the limit per 12 months, {date} - when a slot frees up
  'events.createRight': 'Di bot ini, acara bisa dibuat oleh pemilik bot dan orang yang dia izinkan.',
  'events.limit': 'Dalam 12 bulan kamu bisa membuat paling banyak {limit} acara. Acara berikutnya bisa dibuat mulai {date}.',
  // Shared app button under an event message
  'events.openButton': '🎁 Buka',
  // Finishing
  'events.alreadyFinished': 'Acara sudah selesai.',
  'events.finished': '🏁 <b>Acara {title} telah selesai.</b> Terima kasih sudah bermain!\n\nSurat untuk Santa sekarang hanya bisa dibaca. Obrolan masih terbuka 7 hari lagi (sampai {until}), setelah itu hanya bisa dibaca. Riwayat acara tetap tersimpan di aplikasi.',
  'events.finishedButton': '📚 Buka',
  // Deletion and full reset
  'events.deleted': '🗑 Acara {title} dihapus oleh pemilik beserta surat dan obrolannya.',
  'events.alreadyDeleted': 'Acara sudah dihapus.',
  'events.reset': '🎄 Pemilik memulai ulang acara {title}. Data sebelumnya sudah dihapus. Untuk ikut, minta tautan undangan yang baru.',
  'events.resetRace': 'Acara sudah direset atau berubah bersamaan dengan reset — muat ulang layar.',
  // Inviting participants of another event
  'events.registrationClosed': 'Pendaftaran ditutup — buka pendaftaran untuk mengundang.',
  'events.setupFirst': 'Buka dulu halaman penyiapan /setup (lihat README).',
  'events.invite': '📨 <b>Undangan ke acara {title}</b> — Secret Santa.\nTekan tombol untuk ikut.',
  'events.inviteButton': '🎄 Ikut',
  'events.inviteAgain': 'Undangan sudah dikirim — bisa diulang setelah satu menit.',
  // Reveal: {name} — Santa name
  'events.alreadyRevealed': 'Rahasia sudah terungkap.',
  'events.revealed': '🎅 <b>Rahasia terungkap!</b>\n\nDi acara {title}, Secret Santa-mu adalah <b>{name}</b>. Selamat merayakan! 🎄',
  // Reminders: empty letter (with and without deadline)
  'events.remindAgain': 'Pengingat sudah dikirim — bisa diulang setelah satu menit.',
  'events.remindUnfilled': '⏰ Pengingat: suratmu untuk Santa di acara {title} masih kosong. Isi suratnya supaya Santa lebih mudah memilih kado.',
  'events.remindUnfilledBy': '⏰ Pengingat: suratmu untuk Santa di acara {title} masih kosong. Isi paling lambat <b>{date}</b> supaya Santa lebih mudah memilih kado.',
  // Announcements
  'events.announceFinished': 'Acara sudah selesai — pengumuman tidak bisa dikirim lagi.',
  'events.announceEmpty': 'Tulis teks pengumuman.',
  'events.announcement': '📣 <b>Pengumuman · {title}</b>\n\n{text}',
  'events.announcementButton': '📌 Buka acara',
  'events.announceAgain': 'Pengumuman ini sudah dikirim.',
  // Parameters
  'events.ringAfterDraw': 'Undian melingkar tidak bisa diubah setelah undian.',
  // Log details
  'events.auditText.fromTemplate': 'dari templat «{title}»',
  'events.auditText.deleted': '«{title}», peserta: {n}',
  'events.auditText.reset': 'peserta dihapus: {n}',
  'events.auditText.invited': 'dari «{title}», diundang: {n}',
  'events.auditText.pairs': 'pasangan: {n}',
  'events.auditText.received': 'diterima: {n}',
  'events.auditText.settings': 'pengaturan',
  'events.auditText.ring': 'undian melingkar: {state}',
  'events.auditText.avoidPrevious': 'jangan ulangi pasangan sebelumnya: {state}',
  'events.auditText.on': 'aktif',
  'events.auditText.off': 'nonaktif',
  'events.auditText.registrationOpen': 'dibuka',
  'events.auditText.registrationClosed': 'ditutup',
};
