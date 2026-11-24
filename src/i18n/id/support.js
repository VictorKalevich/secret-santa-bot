// Texts of src/support.js (061): participant support requests ("tiket") to organizers. {name}, {author}, {to} —
// names (HTML already escaped), {title} — event title in quotes, {text} — message text.
export default {
  // Refusals
  'support.noRecipients': 'Saat ini tidak ada yang bisa membalas tiket.',
  'support.closed': 'Tiket sudah ditutup.',
  'support.notFound': 'Tiket tidak ditemukan.',
  'support.ownThread': 'Ini tiketmu sendiri — orang lain yang bisa mengambilnya.',
  'support.sendFailed': 'Gagal mengirim — coba lagi.',
  'support.noOpen': 'Tidak ada tiket yang terbuka.',
  'support.hidden': 'Tiket ini ditangani {name} — obrolannya hanya bisa dilihat olehnya dan pemilik.',
  'support.alreadyTaken': 'Tiket sudah diambil oleh {name}.',
  'support.takeOwn': 'Kamu tidak bisa mengambil tiketmu sendiri.',
  'support.ledBy': 'Tiket ini ditangani {name}.',
  'support.passRights': 'Tiket hanya bisa dialihkan oleh yang menanganinya atau oleh pemilik.',
  'support.passTarget': 'Tiket hanya bisa dialihkan ke pemilik atau admin lain.',
  'support.alreadyLed': 'Tiket ini memang sudah ditangani {name}.',
  'support.passRace': 'Tiket berubah bersamaan dengan tindakan ini — muat ulang layar dan coba lagi.',
  'support.closeRights': 'Tiket hanya bisa ditutup oleh yang menanganinya atau oleh pemilik.',
  // Assignee without a name
  'support.assigneeFallback': 'penanggung jawab',
  // Buttons under notices
  'support.openButton': '💬 Buka',
  'support.takeButton': '🙋 Ambil',
  // Who replied or closed — to the participant ({role})
  'support.role.owner': 'Pemilik',
  'support.role.admin': 'Admin',
  // Notices to organizers
  'support.notice.opened': '🆘 <b>{name}</b> minta bantuan di acara {title}:\n\n{text}',
  'support.notice.added': '💬 <b>{name}</b> menambahkan pesan ke tiket ({title}):\n\n{text}',
  'support.notice.writes': '💬 <b>{name}</b> menulis di tiket ({title}):\n\n{text}',
  'support.notice.closedByUser': '✅ <b>{name}</b> menutup tiket ({title}).',
  'support.notice.taken': '🙋 <b>{name}</b> mengambil tiket <b>{author}</b> ({title}).',
  'support.notice.passedToYou': '↪️ <b>{name}</b> mengalihkan tiket <b>{author}</b> ({title}) kepadamu.',
  'support.notice.passed': '↪️ <b>{name}</b> mengalihkan tiket <b>{author}</b> ({title}) — sekarang ditangani <b>{to}</b>.',
  'support.notice.closed': '✅ <b>{name}</b> menutup tiket <b>{author}</b> ({title}).',
  'support.notice.returned': '🔄 Tiket <b>{author}</b> ({title}) kembali tanpa penanggung jawab.',
  // Notices to the participant
  'support.user.taken': '🙋 Tiketmu di acara {title} diambil oleh <b>{name}</b> — balasannya akan datang ke sini.',
  'support.user.reply': '💬 {role} <b>{name}</b> membalas ({title}):\n\n{text}',
  'support.user.passed': '↪️ Tiketmu di acara {title} sekarang ditangani <b>{name}</b>.',
  'support.user.closed': '✅ {role} <b>{name}</b> menutup tiketmu di acara {title}. Kalau masih ada pertanyaan, tulis saja lagi.',
  'support.user.returned': '🔄 Tiketmu di acara {title} kembali menunggu balasan.',
};
