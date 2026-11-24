// Texts of src/companies.js (061): rooms — creation, names, room owner, owner link, deletion.
export default {
  // Refusals
  'companies.ownLimit': 'Kamu hanya bisa mengelola paling banyak dua ruang milikmu — serahkan atau hapus salah satunya.',
  'companies.recent': 'Ruang dengan nama ini baru saja dibuat.',
  'companies.nameRule': 'Nama ruang harus 1 sampai 40 karakter.',
  'companies.labelRule': 'Nama maksimal 40 karakter.',
  'companies.hasEvents': 'Masih ada acara di ruang ini — hapus dulu acaranya.',
  'companies.ownDelete': 'Hanya pemiliknya yang bisa menghapus ruang ini.',
  'companies.alreadyOwner': 'Dia sudah menjadi pemilik.',
  // Room owner link (bot: /start own_<code>)
  'companies.ownerLinkGone': 'Tautan pemilik ini sudah dipakai atau dicabut. Minta tautan baru.',
  'companies.newOwner': '👑 Kamu pemilik ruangmu sendiri di «Secret Santa»: kamu membuat acara, mengundang orang, dan menunjuk admin.',
  // Room without its own or shared name — its number among the rooms of the person
  'companies.numbered': 'Ruang {n}',
  // Room owner change: {who}, {by} — names (HTML), {title} — room name in quotes
  'companies.owner.transferred': '👑 <b>Hak pemilik ruang telah diserahkan kepadamu.</b> Sekarang kamu menunjuk dan mencopot admin, mereset dan menghapus acara, membuka tampilan khusus — semuanya di aplikasi.',
  'companies.owner.returned': '👑 <b>{by}</b> menyerahkan ruang {title} kepadamu: kamu kembali mengelolanya.',
  'companies.owner.prevNext': 'ℹ️ Hak pemilik ruang sekarang ada di <b>{who}</b>. Kamu tetap menjadi admin.',
  'companies.owner.prevBot': 'ℹ️ Ruang ini kembali dikelola oleh pemilik bot. Kamu tetap menjadi admin.',
  'companies.owner.byLink': '👑 <b>{who}</b> sekarang pemilik ruang {title}.',
  'companies.owner.byLinkUsername': '👑 <b>{who}</b> (@{username}) sekarang pemilik ruang {title}.',
  'companies.owner.passed': 'ℹ️ <b>{by}</b> menyerahkan hak pemilik ruang {title}: pemiliknya sekarang <b>{who}</b>.',
  'companies.owner.notice': 'ℹ️ <b>{who}</b> sekarang menjadi pemilik.',
  // Deleting an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': 'Pemilik menghapus ruang tempat kamu menjadi admin: tidak ada acara di dalamnya.',
  'companies.deleted.yours': 'Pemilik bot menghapus ruang yang kamu kelola: tidak ada acara di dalamnya.',
  'companies.deleted.admin': 'Pemilik bot menghapus ruang tempat kamu menjadi admin: tidak ada acara di dalamnya.',
  // Log: {title} — room name
  'companies.audit.byLink': 'lewat tautan: {name}',
  'companies.audit.toBotOwner': '→ pemilik bot',
  'companies.audit.ownerChanged': '«{title}»: {details}',
  'companies.audit.linkRevoked': '«{title}»: dicabut',
  'companies.audit.linkCreated': '«{title}»: dibuat',
  'companies.audit.roomDeleted': '«{title}», orang: {n}',
};
