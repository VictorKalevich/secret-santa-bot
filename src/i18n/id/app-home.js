// Texts of app part 03-home (060): the "My events" home screen and the "New event" sheet (063)
export default {
  // Leaving an event or a tab: asks only about what is not saved by itself
  'app.home.unsaved': 'Surat belum disimpan. Keluar tanpa menyimpan?',
  // Error screen of an event — back to the list
  'app.home.toEvents': 'Ke daftar acara',
  // Shared labels (also on the event screen)
  'app.home.you': '  (kamu)',
  // Event state: chips in the list; "active" — also the "Status" row on "Info"
  'app.home.finished': 'selesai',
  'app.home.active': 'berlangsung',
  'app.home.notMember': 'kamu tidak ikut',
  // Home screen (063): running and finished events; {n} - number of finished ones
  'app.home.greet': 'Halo, {name}!',
  'app.home.going': 'Berlangsung',
  'app.home.done': 'Selesai · {n}',
  'app.home.empty.create': 'Belum ada acara. Buat acaramu sendiri — tombolnya di bawah — atau minta tautan undangan ke sebuah acara.',
  'app.home.empty.join': 'Kamu belum ikut acara apa pun. Minta tautan undangan ke sebuah acara.',
  // Bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': 'Kamu di sini sebagai pemilik bot: kamu tidak ada di daftar orang acara ini, dan pesan untuk admin tidak dikirim kepadamu. Perubahanmu dicatat di log acara.',
  // New event (007: from a template; 063: the creator is the owner, limit); {year} is the next year
  'app.home.create.button': '🎄 Buat acara',
  'app.home.create.title': 'Acara baru',
  'app.home.create.hint': 'Tulis nama acara',
  'app.home.create.name': 'Nama acara',
  'app.home.create.placeholder': 'Tahun Baru {year} — keluarga',
  'app.home.create.noTemplate': 'Tanpa templat — mulai dari nol',
  'app.home.create.fromTemplate': 'Dari templat: {title}',
  'app.home.create.invite': 'Undang peserta acara templat',
  'app.home.create.templateHint': 'Dari templat disalin anggaran, tempat, catatan, aturan undian, dan pengecualian. Tanggal tidak disalin.',
  'app.home.create.participate': 'Aku juga ikut',
  // Limit (063): {n} - how many more are allowed; {limit} - the limit per 12 months, {date} - when a slot frees up
  'app.home.create.left': {
    other: 'Kamu masih bisa membuat {n} acara lagi dalam 12 bulan.',
  },
  'app.home.create.full': 'Dalam 12 bulan kamu bisa membuat paling banyak {limit} acara. Acara berikutnya bisa dibuat mulai {date}.',
  'app.home.create.done': '🎄 Acara dibuat',
  'app.home.create.doneInvited': '🎄 Acara dibuat, undangan: {count}',
  'app.home.create.doneInviteError': '🎄 Acara dibuat. {error}',
};
