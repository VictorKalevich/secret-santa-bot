// Texts of src/stale.js (061): warning about automatic finishing of an abandoned event. Reasons: empty, age (064: only events without a date)
export default {
  // {when} — finishing date, {why} — stale.why.<reason>, {keep} — stale.keep.<reason>
  'stale.warning': '⏳ <b>Acara {title} akan otomatis selesai pada {when}.</b>\n{why}\n\n{keep}',
  'stale.openButton': '⚙️ Buka acara',
  // Why the event is considered abandoned
  'stale.why.empty': 'Belum ada yang bergabung selain pemilik dan admin.',
  'stale.why.age': 'Acara ini tidak punya tanggal tukar kado dan dibuat lebih dari tujuh minggu lalu.',
  // How to keep the event
  'stale.keep.empty': 'Kalau acara ini masih diperlukan, undang peserta atau isi tanggal tukar kado: «Kelola» → «Pengaturan».',
  'stale.keep.age': 'Kalau acara ini masih diperlukan, isi tanggal tukar kado: «Kelola» → «Pengaturan».',
  // Log detail of finish.warn: {why} — stale.logged.<reason>
  'stale.auditText': '{why}; selesai pada {when}',
  'stale.logged.date': 'tanggal tukar kado sudah lewat',
  'stale.logged.empty': 'belum ada yang bergabung selain pemilik dan admin',
  'stale.logged.age': 'tidak ada tanggal tukar kado',
};
