// Texts of src/companies.js (060): rooms — creation, names, room owner, owner link, deletion
export default {
  'companies.ownLimit': 'Możesz prowadzić najwyżej dwa własne pokoje — przekaż lub usuń jeden z nich.',
  'companies.recent': 'Pokój o tej nazwie został właśnie utworzony.',
  'companies.nameRule': 'Nazwa pokoju — od 1 do 40 znaków.',
  'companies.labelRule': 'Nazwa — do 40 znaków.',
  'companies.hasEvents': 'W pokoju są wydarzenia — najpierw je usuń.',
  'companies.ownDelete': 'Usunąć pokój może tylko jego właściciel.',
  'companies.alreadyOwner': 'Ta osoba jest już właścicielem.',
  'companies.ownerLinkGone': 'Ten link właściciela został już użyty lub odwołany. Poproś o nowy.',
  'companies.newOwner': '👑 Jesteś właścicielem własnego pokoju w „Tajemniczym Mikołaju”: tworzysz wydarzenia, zapraszasz ludzi, mianujesz administratorów.',
  'companies.numbered': 'Pokój {n}',
  // Room owner change: {who}, {by} — names (HTML), {title} — room name in quotes
  'companies.owner.transferred': '👑 <b>Przekazano Ci prawa właściciela pokoju.</b> Teraz mianujesz i odwołujesz administratorów, resetujesz i usuwasz wydarzenia, otwierasz podgląd serwisowy — wszystko w aplikacji.',
  'companies.owner.returned': '👑 <b>{by}</b> przekazał(a) Ci pokój {title}: znów prowadzisz go Ty.',
  'companies.owner.prevNext': 'ℹ️ Prawa właściciela pokoju ma teraz <b>{who}</b>. Pozostajesz administratorem.',
  'companies.owner.prevBot': 'ℹ️ Pokój znów prowadzi właściciel bota. Pozostajesz administratorem.',
  'companies.owner.byLink': '👑 <b>{who}</b> jest teraz właścicielem pokoju {title}.',
  'companies.owner.byLinkUsername': '👑 <b>{who}</b> (@{username}) jest teraz właścicielem pokoju {title}.',
  'companies.owner.passed': 'ℹ️ <b>{by}</b> przekazał(a) prawa właściciela pokoju {title}: teraz właścicielem jest <b>{who}</b>.',
  'companies.owner.notice': 'ℹ️ <b>{who}</b> jest teraz właścicielem.',
  // Deletion of an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': 'Właściciel usunął pokój, w którym pełnisz rolę administratora: nie było w nim wydarzeń.',
  'companies.deleted.yours': 'Właściciel bota usunął prowadzony przez Ciebie pokój: nie było w nim wydarzeń.',
  'companies.deleted.admin': 'Właściciel bota usunął pokój, w którym pełnisz rolę administratora: nie było w nim wydarzeń.',
  // Log: {title} — room name
  'companies.audit.byLink': 'przez link: {name}',
  'companies.audit.toBotOwner': '→ właściciel bota',
  'companies.audit.ownerChanged': '„{title}”: {details}',
  'companies.audit.linkRevoked': '„{title}”: odwołany',
  'companies.audit.linkCreated': '„{title}”: utworzony',
  'companies.audit.roomDeleted': '„{title}”, osób: {n}',
};
