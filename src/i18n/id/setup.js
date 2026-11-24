// Texts of src/setup.js (061): the /setup page, commands, menu button and bot descriptions.
// Paragraph markup (<code>, <b>) is part of the text
export default {
  'setup.title': 'Penyiapan',
  // Key form
  'setup.form.label': 'Kunci penyiapan (nilai rahasia ADMIN_SECRET)',
  'setup.form.clear': 'Kosongkan kolom «Kunci penyiapan»',
  'setup.form.submit': 'Siapkan bot',
  'setup.noSecret.title': 'ADMIN_SECRET diperlukan',
  'setup.noSecret.text': 'Atur rahasia ADMIN_SECRET dengan panjang minimal 8 karakter (lihat petunjuk).',
  'setup.start.title': '🎄 Penyiapan bot',
  'setup.start.text': 'Masukkan kunci penyiapan — kunci yang kamu atur dengan perintah\n<code>npx wrangler secret put ADMIN_SECRET</code>.',
  'setup.badKey.title': 'Kunci salah',
  'setup.badKey.text': 'Kunci tidak cocok. Periksa nilai ADMIN_SECRET.',
  // The owner link has been used
  'setup.locked.title': '🔒 Halaman dikunci',
  'setup.locked.used': 'Tautan pemilik sudah dipakai, jadi halaman penyiapan tidak lagi menampilkannya dan tidak mengubah pengaturan bot.',
  'setup.locked.unlock': 'Untuk membuka kunci (misalnya kalau tautannya bocor atau hak pemilik perlu diambil kembali), ganti kuncinya:',
  'setup.locked.then': 'Lalu buka halaman ini lagi dan masukkan kunci baru — tautan pemilik baru akan muncul, dan yang lama tidak berlaku lagi.',
  // Setup steps
  'setup.step.token': 'Token bot',
  'setup.step.webhook': 'Webhook',
  'setup.step.commands': 'Perintah',
  'setup.step.menuButton': 'Tombol aplikasi',
  // Commands and descriptions in other languages are sent later, with people requests
  'setup.profileLater': 'bahasa lainnya akan dikirim bot ke Telegram dalam beberapa menit',
  'setup.failed': 'Gagal',
  // Commands, menu button and bot descriptions in Telegram
  'setup.command.start': 'Menu utama dan acaraku',
  'setup.command.language': 'Bahasa bot',
  'setup.command.cancel': 'Batalkan input',
  'setup.menuButton': '🎁 Santa',
  'setup.description': '🎄 Bot tertutup untuk bermain Secret Santa: surat untuk Santa, undian dengan pengecualian, pesan anonim. Masuk lewat tautan undangan ke acara.',
  'setup.shortDescription': '🎄 Secret Santa untuk teman, keluarga, dan rekan kerja',
  // Result
  'setup.done.ok': '✅ Bot sudah siap',
  'setup.done.problems': '⚠️ Ada masalah',
  'setup.done.linkTitle': '1. Tautan pemilik',
  'setup.done.linkText': 'Buka di Telegram — bot akan menjadikanmu <b>pemilik bot</b>. Pemilik membuat acara, menunjuk dan mencopot\nadmin di aplikasi (layar utama → «Pemilik dan admin») dan bisa membuka tampilan khusus pasangan.',
  'setup.done.linkWarn': '⚠️ Tautan ini <b>hanya berfungsi sekali</b>: setelah dibuka, halaman ini dikunci sampai kamu mengganti\nADMIN_SECRET. Jangan teruskan ke siapa pun — siapa yang membukanya pertama akan menjadi pemilik. Kalau itu terjadi, ganti ADMIN_SECRET,\nbuka halaman ini lagi dan buka tautan yang baru. Selama tautan belum dipakai, halaman ini bisa dibuka lagi.',
  'setup.done.eventTitle': '2. Buat acara',
  'setup.done.eventText': 'Di chat dengan bot, tekan «🎁 Santa» → «🎄 Buat». Setiap acara punya tautan undangan sendiri — tautan ini bisa\ndisalin atau dikirim ke chat langsung dari aplikasi (tab «Kelola» di acara).',
};
