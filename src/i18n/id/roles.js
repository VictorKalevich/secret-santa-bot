// Texts of src/roles.js (061): bot owner, admins, moving participation. {name}, {from}, {to}, {actor} — names (HTML)
export default {
  // App button under a message about new rights
  'roles.openButton': '🛠 Buka',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ Hak pemilik bot berpindah ke <b>{name}</b> lewat tautan dari halaman penyiapan. Kamu tetap menjadi admin.\n\nKalau itu bukan kamu dan tidak disepakati — ganti ADMIN_SECRET (lihat README), buka halaman penyiapan, lalu buka tautan pemilik yang baru.',
  'roles.botOwner.transferred': '👑 <b>Hak pemilik bot telah diserahkan kepadamu.</b> Sekarang kamu menunjuk dan mencopot admin — bagian «Pemilik dan admin» di layar utama aplikasi.',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> sekarang pemilik bot.',
  // Owner rights transfer (bot and room)
  'roles.transferTarget': 'Hak pemilik hanya bisa diserahkan kepada orang yang sudah terdaftar.',
  'roles.alreadyOwnerSelf': 'Kamu memang sudah pemilik.',
  'roles.alreadyTransferred': 'Hak pemilik sudah diserahkan.',
  // Admins
  'roles.alreadyAdmin': 'Dia sudah menjadi admin.',
  'roles.notAdmin': 'Dia bukan admin.',
  'roles.grantUnregistered': 'Hanya orang yang sudah terdaftar yang bisa ditunjuk.',
  'roles.revokeOwner': 'Hak pemilik tidak bisa dicopot. Serahkan dulu hak pemilik.',
  'roles.granted': '🛠 <b>Pemilik menunjukmu sebagai admin.</b>\n\nSekarang kamu bisa membuat dan mengelola acara: undangan, pengecualian, undian, pengingat. Pasangan hanya bisa dibuka oleh pemilik di tampilan khusus.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> sekarang admin.',
  'roles.revoked': 'Pemilik mencopot hak adminmu. Sebagai peserta, kamu tetap bermain seperti biasa.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> bukan admin lagi.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Pilih dua akun yang berbeda.',
  'roles.transfer.staffTarget': 'Keikutsertaan tidak bisa dipindahkan ke akun pemilik atau admin.',
  'roles.transfer.noOld': 'Akun lama tidak ditemukan.',
  'roles.transfer.unregistered': 'Akun baru harus menyelesaikan pendaftaran (menulis nama ke bot).',
  'roles.transfer.inDraw': 'Akun baru sudah ikut undian acara «{title}» — pilih akun lain.',
  'roles.transfer.toNew': '🔁 Pemilik memindahkan keikutsertaanmu di «Secret Santa» ke akun ini: surat, penerima kado, obrolan, dan riwayat acara tetap tersimpan.',
  'roles.transfer.toOld': '🔁 Keikutsertaanmu di «Secret Santa» dipindahkan ke akun <b>{to}</b>. Kalau kamu tidak meminta pemindahan ini, hubungi pemilik.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> memindahkan keikutsertaan <b>{from}</b> ke akun <b>{to}</b>.',
  // Log: new owner; moving "old record -> new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
