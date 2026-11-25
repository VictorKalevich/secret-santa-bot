// Texts of src/roles.js (060): bot owner, event owner and admins (063), participation transfer. {name}, {from}, {to},
// {actor}, {who} in messages - names (HTML), {title} - the event title in quotes (HTML)
export default {
  // App button under a message about new rights
  'roles.openButton': '🛠 Buka',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ Hak pemilik bot berpindah ke <b>{name}</b> lewat tautan dari halaman penyiapan. Acaramu tetap milikmu.\n\nKalau itu bukan kamu dan tidak disepakati — ganti ADMIN_SECRET (lihat README), buka halaman penyiapan, lalu buka tautan pemilik yang baru.',
  'roles.botOwner.transferred': '👑 <b>Hak pemilik bot telah diserahkan kepadamu.</b> Log bot, semua acara, dan penyerahan hak ada di aplikasi: ⚙️ «Pengaturan» → «Pemilik bot».',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> sekarang pemilik bot.',
  // Passing the bot owner rights
  'roles.transferTarget': 'Hak pemilik hanya bisa diserahkan kepada orang yang sudah terdaftar.',
  'roles.alreadyOwnerSelf': 'Kamu memang sudah pemilik.',
  'roles.alreadyTransferred': 'Hak pemilik sudah diserahkan.',
  // Event admins
  'roles.alreadyAdmin': 'Dia sudah menjadi admin.',
  'roles.notAdmin': 'Dia bukan admin.',
  'roles.grantMember': 'Hanya peserta acara yang bisa ditunjuk.',
  'roles.revokeOwner': 'Hak pemilik tidak bisa dicopot. Serahkan dulu kepemilikan acara.',
  'roles.granted': '🛠 <b>Kamu ditunjuk sebagai admin acara {title}.</b>\n\nSekarang kamu bisa mengelolanya: undangan, pengecualian, undian, pengingat. Pasangan hanya bisa dibuka oleh pemilik acara di tampilan khusus.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> sekarang admin acara {title}.',
  'roles.revoked': 'Hak adminmu di acara {title} dicopot. Kalau kamu ikut acara ini, kamu tetap bermain seperti biasa.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> bukan admin acara {title} lagi.',
  // Event ownership
  'roles.owner.already': 'Dia sudah menjadi pemilik.',
  'roles.owner.target': 'Kepemilikan hanya bisa diserahkan kepada peserta atau admin acara.',
  'roles.owner.alreadyPassed': 'Kepemilikan sudah diserahkan.',
  'roles.owner.toNew': '👑 <b>Kamu sekarang pemilik acara {title}.</b> Kamu menunjuk admin, membuka tampilan khusus, mereset dan menghapus acara — semuanya di aplikasi.',
  'roles.owner.toPrev': 'ℹ️ Kepemilikan acara {title} berpindah ke <b>{who}</b>. Kamu tetap menjadi admin.',
  'roles.owner.notice': 'ℹ️ Pemilik acara {title} sekarang <b>{who}</b>.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Pilih dua akun yang berbeda.',
  'roles.transfer.staffTarget': 'Keikutsertaan tidak bisa dipindahkan ke akun pemilik atau admin.',
  'roles.transfer.noOld': 'Akun lama tidak ditemukan.',
  'roles.transfer.unregistered': 'Akun baru harus menyelesaikan pendaftaran (menulis nama ke bot).',
  'roles.transfer.inDraw': 'Akun baru sudah ikut undian acara «{title}» — pilih akun lain.',
  'roles.transfer.toNew': '🔁 Pemilik bot memindahkan keikutsertaanmu di «Secret Santa» ke akun ini: surat, penerima kado, obrolan, dan riwayat acara tetap tersimpan.',
  'roles.transfer.toOld': '🔁 Keikutsertaanmu di «Secret Santa» dipindahkan ke akun <b>{to}</b>. Kalau kamu tidak meminta pemindahan ini, hubungi pemilik bot.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> memindahkan keikutsertaan <b>{from}</b> ke akun <b>{to}</b>.',
  // Log: new owner; moving "old record -> new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
