// Texts of src/api.js (060): check pipeline and action handlers. {owner.nom}, {owner.dat} - "the owner" or "the bot owner"
// (ownerWord of the event) in the needed form; {word} - the confirmation word of the action.
export default {
  'api.badInitData': 'Gagal memverifikasi login. Buka lagi aplikasinya dari chat dengan bot.',
  'api.unknownAction': 'Tindakan tidak dikenal',
  'api.noEvent': 'Acara tidak ditemukan.',
  // What is not allowed in a finished event
  'api.closed': 'Acara sudah selesai — tidak bisa diubah lagi (masih bisa dilihat, diungkap, dan dihapus).',
  'api.letterClosed': 'Acara sudah selesai: surat sekarang hanya bisa dibaca.',
  'api.markClosed': 'Acara sudah selesai: tanda ini hanya bisa dibaca.',
  // Confirmation word missing
  'api.confirm.delete': 'Untuk menghapus, ketik kata {word}.',
  'api.confirm.leave': 'Untuk keluar, ketik kata {word}.',
  'api.confirm.cancel': 'Untuk membatalkan, ketik kata {word}.',
  'api.confirm.reset': 'Untuk reset total, ketik kata {word}.',
  'api.confirm.vault': 'Untuk membuka tampilan khusus, ketik kata {word}.',
  // Refusal to a non-owner
  'api.owner.roles': 'Hanya {owner.nom} yang bisa menunjuk dan mencopot admin.',
  'api.owner.vault': 'Tampilan khusus hanya tersedia untuk {owner.dat}.',
  'api.owner.swap': 'Hanya {owner.nom} yang bisa menukar penerima kado setelah undian.',
  'api.owner.transfer': 'Hanya {owner.nom} yang bisa menyerahkan kepemilikan acara.',
  'api.owner.insert': 'Hanya {owner.nom} yang bisa memasukkan peserta ke undian yang sudah dilakukan.',
  'api.owner.fixed': 'Hanya {owner.nom} yang bisa menetapkan pasangan tetap.',
  'api.owner.forceCancel': 'Hanya {owner.nom} yang bisa membatalkan undian secara paksa.',
  'api.owner.eventDelete': 'Hanya {owner.nom} yang bisa menghapus acara.',
  'api.owner.reset': 'Hanya {owner.nom} yang bisa melakukan reset total.',
  'api.botOwner.transfer': 'Hanya pemilik bot yang bisa memindahkan keikutsertaan ke akun baru.',
  'api.botOwner.rename': 'Hanya pemilik bot yang bisa mengganti nama seseorang.',
  'api.botOnly': 'Hanya untuk pemilik bot.',
  // Handlers
  'api.nameRule': 'Nama harus 1 sampai 40 karakter',
  // Language choice: code not in the bot languages
  'api.lang.unknown': 'Bahasa ini tidak tersedia.',
  'api.templateNotFound': 'Templat tidak ditemukan.',
  'api.memberNotFound': 'Peserta tidak ditemukan',
  'api.ownerNotTransferred': 'Data pemilik tidak dipindahkan: pemilik memulihkan akses lewat tautan pemilik yang baru (ganti ADMIN_SECRET → halaman /setup).',
  'api.removeSelf': 'Kamu tidak bisa mengeluarkan dirimu sendiri — matikan «Aku ikut».',
  'api.removeOwner': 'Pemilik tidak bisa dikeluarkan dari acara. Ia harus menyerahkan hak pemilik terlebih dahulu.',
  'api.removeAdmin': 'Hanya {owner.nom} yang bisa mengeluarkan admin.',
  'api.drawDone': 'Undian sudah dilakukan.',
  'api.chooseOtherEvent': 'Pilih acara lain.',
  'api.inviteFinished': 'Acara sudah selesai — tidak bisa mengundang ke acara ini.',
};
