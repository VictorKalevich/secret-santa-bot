// Texts of app part 04-companies (061): "Rooms" screen, "Room" sheet, owner link, bot owner rights.
// In texts for people — "ruang" (room)
export default {
  // Role of the person in a room row
  // "Rooms" screen
  'app.companies.title': 'Ruang',
  'app.companies.empty': 'Belum ada ruang. Buat ruangmu sendiri — atau minta tautan undangan ke sebuah acara.',
  'app.companies.emptyBotOwner': 'Belum ada ruang.',
  'app.companies.create': '🚪 Buat ruang',
  'app.companies.ownLimit': 'Kamu hanya bisa mengelola paling banyak dua ruang milikmu — serahkan atau hapus salah satunya.',
  'app.companies.botLog': '📜 Log bot',
  // Room row: who owns it, how many events; buttons
  'app.companies.about': 'Pemilik — {owner} · acara: {events}',
  'app.companies.aboutIdle': 'Pemilik — {owner} · acara: {events} · tidak ada yang berlangsung',
  'app.companies.roomName': 'Nama ruang',
  'app.companies.ownName': 'Nama pribadi',
  'app.companies.settings': 'Ruang',
  // Name sheet
  'app.companies.label.field': 'Nama',
  'app.companies.label.shared': 'Nama ini terlihat oleh semua orang di ruang ini.',
  'app.companies.label.botOwner': 'Nama ruang ini hanya terlihat olehmu — pemilik bot.',
  'app.companies.label.own': 'Nama ini hanya terlihat olehmu.',
  'app.companies.label.saved': 'Nama tersimpan',
  // New room
  'app.companies.new.title': 'Ruang baru',
  'app.companies.new.placeholder': 'Misalnya: Kantor',
  'app.companies.new.done': '🚪 Ruang dibuat',
  'app.companies.new.hintOwn': 'Kamu akan menjadi pemilik ruang: membuat acara, mengundang orang, menunjuk admin. Nama ruang akan terlihat oleh semua orang di ruang ini.',
  'app.companies.new.hintBot': 'Setiap ruang punya orang, acara, keluarga, dan admin sendiri. Kamu bisa mengelolanya sendiri atau menyerahkannya ke pemilik lewat tautan.',
  // "Room" sheet of the bot owner: who runs it
  'app.companies.lead.title': 'Siapa yang mengelola',
  'app.companies.lead.you': 'Kamu',
  'app.companies.lead.botRun': 'Ruang ini tidak punya pemilik sendiri: kamu yang mengelolanya.',
  'app.companies.lead.owner': 'Pemilik ruang: admin, reset dan hapus acara, tampilan khusus pasangan.',
  'app.companies.lead.self': 'Kelola sendiri',
  'app.companies.lead.selfConfirm': 'Kelola ruang ini sendiri? «{name}» tetap menjadi admin.',
  'app.companies.lead.selfDone': 'Ruang ini kembali kamu kelola',
  // Room owner link
  'app.companies.link.title': '🔗 Tautan pemilik ruang',
  'app.companies.link.hint': 'Tautan ini sekali pakai: siapa yang pertama membukanya akan menjadi pemilik ruang dan bisa membuka pasangan di acara-acaranya. Kirimkan secara pribadi.',
  'app.companies.link.active': 'Tautan masih berlaku. Tautan tidak bisa ditampilkan lagi — kamu bisa membuat yang baru.',
  'app.companies.link.copy': '📋 Salin',
  'app.companies.link.shareText': '👑 Tautan pemilik di «Secret Santa»: buka tautan ini untuk mengelola ruangmu sendiri.',
  'app.companies.link.create': 'Buat tautan',
  'app.companies.link.renew': 'Buat yang baru',
  'app.companies.link.revoke': 'Cabut',
  'app.companies.link.revoked': 'Tautan dicabut',
  // Deleting an empty room (sheet with a confirmation word)
  'app.companies.delete.section': 'Penghapusan',
  'app.companies.delete.hasEvents': 'Masih ada acara di ruang ini — hapus dulu acaranya.',
  'app.companies.delete.button': '🗑 Hapus ruang',
  'app.companies.delete.title': 'Hapus ruang',
  'app.companies.delete.lines': ['orang, admin, dan keluarga di dalamnya;', 'log umum ruang ini.'],
  'app.companies.delete.keepBot': 'Tidak ada acara di ruang ini. Pemilik dan admin ruang akan menerima pesan.',
  'app.companies.delete.keepOwn': 'Tidak ada acara di ruang ini. Admin ruang akan menerima pesan.',
  'app.companies.delete.done': 'Ruang dihapus',
  // Passing the bot owner rights
  'app.companies.botOwner.pass': '👑 Serahkan hak pemilik bot',
  'app.companies.botOwner.title': 'Hak pemilik bot',
  'app.companies.botOwner.hint': 'Pemilik bot hanya satu. Hak ini bisa diserahkan ke orang dari ruang yang kamu kelola.',
  'app.companies.botOwner.choose': 'Serahkan ke siapa…',
  'app.companies.botOwner.confirm': 'Serahkan hak pemilik bot ke «{name}»? Dia akan membuat dan menghapus ruang serta menunjuk pemiliknya. Kamu tetap menjadi admin di ruangmu.',
  'app.companies.botOwner.done': '👑 Hak pemilik bot diserahkan',
};
