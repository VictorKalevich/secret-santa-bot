// Texts of src/membership.js (061): joining, join requests, families, "I take part", leaving
export default {
  // Families: rules and frozen members while a draw is running
  'membership.familyNameRule': 'Nama keluarga harus 1 sampai 40 karakter.',
  'membership.familySize': 'Keluarga harus terdiri dari 2 sampai {max} orang.',
  'membership.familyNotFound': 'Keluarga tidak ditemukan.',
  'membership.memberNotFound': 'Peserta tidak ditemukan.',
  'membership.alreadyInFamily': '{name} sudah ada di keluarga «{family}».',
  'membership.familyFrozen': 'Anggota keluarga tidak bisa diubah selama acara «{title}» dengan undian yang sudah dilakukan masih berlangsung: kalau tidak, pasangan bisa ditebak dari pergantian peserta. Perubahan bisa dilakukan setelah acara itu selesai.',
  // Log: family name and members, "I take part"
  'membership.audit.familySave': '«{name}»: {people}',
  'membership.audit.familyDelete': '«{name}»',
  'membership.audit.isParticipant': 'ikut',
  'membership.audit.notParticipant': 'tidak ikut',
  'membership.afterDraw': 'Setelah undian, ini tidak bisa dilakukan. Minta {owner.gen} untuk memasukkanmu ke undian.',
  // Participant leaving
  'membership.leaveAfterDraw': 'Undian sudah dilakukan. Untuk keluar, hubungi pemilik atau admin.',
  'membership.leaveFinished': 'Acara sudah selesai — kamu tidak bisa keluar lagi.',
  'membership.leaveNotice': '🚪 <b>{name}</b> keluar dari acara {title}.',
  'membership.openEventButton': '🛠 Buka acara',
  // Returning removed people
  'membership.notRemoved': 'Orang ini tidak ada di daftar yang dikeluarkan.',
  // Joining and join requests
  'membership.joinedNotice': '👋 <b>{name}</b> bergabung ke acara {title}',
  'membership.request': '🙋 <b>{name}</b> ingin ikut acara {title}.',
  'membership.requestWithUsername': '🙋 <b>{name}</b> (@{username}) ingin ikut acara {title}.',
  'membership.acceptButton': '✅ Terima',
  'membership.rejectButton': '❌ Tolak',
  'membership.requestNotFound': 'Permintaan bergabung tidak ditemukan.',
  'membership.requestDecided': 'Permintaan bergabung sudah diproses.',
  'membership.approveFinished': 'Acara sudah selesai — tidak bisa menerima peserta lagi.',
  'membership.approveClosed': 'Pendaftaran untuk acara «{title}» ditutup — buka pendaftaran untuk menerima permintaan bergabung.',
  // Decision on a join request: to the participant and other admins
  'membership.approvedAfterDraw': '🎉 Permintaan disetujui — kamu ikut acara {title}! Undian sudah dilakukan — {owner.nom} akan memasukkanmu, dan bot akan mengirim notifikasi. Sementara itu, tulis surat untuk Santa.',
  'membership.approved': '🎉 Permintaan disetujui — kamu ikut acara {title}! Buka aplikasi dan tulis surat untuk Secret Santa-mu.',
  'membership.requestRejected': 'Permintaan bergabung ke acara {title} ditolak. Kalau ini keliru, hubungi pemilik atau admin.',
  'membership.approvedBy': '✅ <b>{by}</b> menerima permintaan <b>{name}</b> untuk ikut acara {title}.',
  'membership.rejectedBy': '❌ <b>{by}</b> menolak permintaan <b>{name}</b> untuk ikut acara {title}.',
};
