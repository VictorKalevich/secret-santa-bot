// Texts of src/stale.js (061): warning about automatic finishing of an abandoned event. Reasons: date, empty, age
export default {
  // {when} — finishing date, {why} — stale.why.<reason>, {keep} — stale.keep.<reason>
  'stale.warning': '⏳ <b>Acara {title} akan otomatis selesai pada {when}.</b>\n{why}\n\n{keep}',
  'stale.openButton': '⚙️ Buka acara',
  // Why the event is considered abandoned
  'stale.why.date': 'Tanggal tukar kado ({date}) sudah lewat.',
  'stale.why.empty': 'Belum ada yang bergabung selain pemilik dan admin.',
  'stale.why.age': 'Acara ini tidak punya tanggal tukar kado dan dibuat lebih dari tiga bulan lalu.',
  // How to keep the event
  'stale.keep.date': 'Kalau acara ini masih diperlukan, ubah tanggal tukar kado: «Kelola» → «Pengaturan».',
  'stale.keep.empty': 'Kalau acara ini masih diperlukan, undang peserta atau isi tanggal tukar kado: «Kelola» → «Pengaturan».',
  'stale.keep.age': 'Kalau acara ini masih diperlukan, isi tanggal tukar kado: «Kelola» → «Pengaturan».',
  // Log detail of finish.warn: {why} — stale.logged.<reason>
  'stale.auditText': '{why}; selesai pada {when}',
  'stale.logged.date': 'tanggal tukar kado sudah lewat',
  'stale.logged.empty': 'belum ada yang bergabung selain pemilik dan admin',
  'stale.logged.age': 'tidak ada tanggal tukar kado',
};
