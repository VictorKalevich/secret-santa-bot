// Texts of src/pairs.js (061): draw, inserting, removing, cancelling, swapping giftees
export default {
  // Why a draw is impossible (pairs.reason.<problem type>); {name} — participant name
  'pairs.reason.too_few': 'Minimal perlu 2 peserta.',
  'pairs.reason.ring_too_few': 'Undian melingkar perlu minimal 3 peserta — atau matikan undian melingkar di pengaturan.',
  'pairs.reason.ring_impossible': 'Sepertinya dengan pengecualian ini pasangan timbal balik tidak bisa dihindari. Coba lagi; kalau tetap gagal, hapus sebagian pengecualian atau matikan undian melingkar.',
  'pairs.reason.no_receivers': '{name} tidak bisa memberi kado ke siapa pun — periksa pengecualian.',
  'pairs.reason.no_givers': 'Tidak ada yang bisa memberi kado ke {name} — periksa pengecualian.',
  'pairs.reason.search_exhausted': 'Pembagian pasangan tidak bisa ditemukan dengan cepat — coba lagi. Kalau tetap gagal, hapus sebagian pengecualian atau matikan undian melingkar.',
  'pairs.reason.fixed_block': 'Pasangan tetap menghalangi: dengan pasangan ini semua orang tidak bisa dibagi sesuai aturan. {owner.nomCap} bisa menghapus sebagian pasangan tetap.',
  'pairs.reason.too_strict': 'Terlalu banyak pengecualian: semua orang tidak bisa dibagi sambil mematuhinya. Hapus sebagian pengecualian.',
  // Families block the draw
  'pairs.familiesBlock': 'Keluarga menghalangi: anggota satu keluarga tidak saling memberi kado, dan dengan begitu semua orang tidak bisa dibagi. Matikan «Perhitungkan keluarga» atau undian melingkar.',
  // Draw
  'pairs.drawn': '🎄 <b>Undian di acara {title} sudah dilakukan!</b>\n\nBuka aplikasi dan lihat tab «Penerima» untuk tahu kepada siapa kamu memberi kado. Jangan bilang siapa-siapa 🤫',
  'pairs.drawnButton': '🎁 Lihat penerima kado',
  'pairs.drawFinished': 'Acara sudah selesai.',
  'pairs.drawRace': 'Peserta, pengecualian, atau keluarga berubah saat undian — coba lagi.',
  'pairs.notDrawn': 'Undian belum dilakukan.',
  // Pairs after a change of members: to the new participant and to a Santa with a new giftee
  'pairs.inserted': '🎄 <b>Kamu ikut bermain!</b> Undian acara {title} untukmu sudah dilakukan — lihat tab «Penerima» 🤫',
  'pairs.newWard': '🔄 Peserta acara {title} berubah, dan sekarang kamu punya <b>penerima kado baru</b>. Lihat tab «Penerima».',
  'pairs.lookButton': '🎁 Lihat',
  // Removing and inserting a participant
  'pairs.notMember': 'Orang ini tidak ikut dalam acara ini.',
  'pairs.removeBlocked': 'Peserta tidak bisa dikeluarkan tanpa melanggar pengecualian atau undian melingkar. Longgarkan pengecualian.',
  'pairs.removed': 'Kamu telah dikeluarkan dari acara {title}. Kalau ini keliru, hubungi pemilik atau admin.',
  'pairs.alreadyInDraw': 'Peserta sudah ada di undian.',
  'pairs.insertBlocked': 'Peserta tidak bisa dimasukkan tanpa melanggar aturan: semua yang penerima kadonya bisa berganti sudah menyiapkan kado, atau pengecualian menghalangi. Kamu bisa membatalkan undian di zona berbahaya dan mengundi ulang.',
  // Swapping giftees: rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': 'Salah satu dari keduanya memberi kado ke yang lain: setelah ditukar, seseorang akan memberi kado ke dirinya sendiri.',
  'pairs.swapRule.exclusion': 'Pengecualian: salah satu dari keduanya akan memberi kado ke orang yang menurut pengecualian tidak boleh ia beri kado.',
  'pairs.swapRule.family': 'Keluarga: salah satu dari keduanya akan memberi kado ke anggota keluarganya sendiri.',
  'pairs.swapRule.ring': 'Undian melingkar: akan muncul pasangan timbal balik — dua orang saling memberi kado.',
  'pairs.swapRule.fixed': 'Pasangan tetap: penukaran akan memutus pasangan yang kamu tetapkan.',
  'pairs.swapRule.history': 'Pasangan sebelumnya: salah satu dari keduanya akan memberi kado ke orang yang sama seperti di acara sebelumnya.',
  'pairs.swapRevealed': 'Rahasia sudah terungkap — penerima kado tidak bisa ditukar.',
  'pairs.swapTwo': 'Pilih dua peserta yang berbeda.',
  'pairs.notInDraw': 'Peserta tidak ada di undian.',
  'pairs.swapStale': 'Pasangan sudah berubah — buka penukaran lagi.',
  'pairs.swapSelf': 'Kedua orang ini tidak bisa ditukar — pilih pasangan lain.',
  'pairs.swapRulesChanged': 'Aturan undian untuk penukaran ini berubah — periksa lagi.',
  'pairs.swapNotice': '🔄 Pemilik mengubah undian acara {title}: sekarang kamu punya <b>penerima kado baru</b>. Pasangan sebelumnya tidak berlaku lagi, obrolannya dihapus. Lihat tab «Penerima».',
  // Cancelling the draw and forced cancel
  'pairs.cancelFinished': 'Acara sudah selesai — undian tidak bisa dibatalkan.',
  'pairs.cancelRevealed': 'Rahasia sudah terungkap — undian tidak bisa dibatalkan.',
  'pairs.cancelBlocked': 'Tidak bisa dibatalkan: seseorang sudah membuka penerima kadonya atau obrolan sudah dimulai.',
  'pairs.cancelled': '↩️ <b>Undian dibatalkan</b> di acara {title}. Suratmu untuk Santa tetap tersimpan. Bot akan mengabari saat ada undian baru.',
  'pairs.forceCancelled': '↩️ Pemilik <b>membatalkan undian</b> di acara {title}. Pasangan sebelumnya tidak berlaku lagi, obrolan dengan Santa dan penerima kado sudah dihapus. Suratmu tetap tersimpan. Bot akan mengabari saat ada undian baru.',
  // Log details
  'pairs.auditText.members': 'peserta: {n}',
  'pairs.auditText.changed': 'pasangan diubah: {n}',
  'pairs.auditText.removed': 'pasangan dihapus: {n}',
};
