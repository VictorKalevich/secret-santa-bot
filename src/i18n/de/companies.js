// Texts of src/companies.js (061, German): rooms - creation, names, room owner, owner link, deletion. Owner rights
// refusals (target, "already owner", "already transferred") are shared with roles.js, keys roles.*
export default {
  // Refusals
  'companies.ownLimit': 'Du kannst höchstens zwei eigene Räume leiten – übergib oder lösche einen davon.',
  'companies.recent': 'Ein Raum mit diesem Namen wurde gerade erstellt.',
  'companies.nameRule': 'Der Raumname muss 1 bis 40 Zeichen lang sein.',
  'companies.labelRule': 'Der Name darf bis zu 40 Zeichen lang sein.',
  'companies.hasEvents': 'Im Raum gibt es Runden – lösche sie zuerst.',
  'companies.ownDelete': 'Einen Raum löschen kann nur sein Inhaber.',
  'companies.alreadyOwner': 'Diese Person ist bereits Inhaber.',
  // Room owner link (bot: /start own_<code>)
  'companies.ownerLinkGone': 'Dieser Inhaber-Link wurde bereits verwendet oder widerrufen. Bitte um einen neuen.',
  'companies.newOwner': '👑 Du bist jetzt Inhaber deines eigenen Raums beim Wichteln: Du erstellst Runden, lädst Leute ein und ernennst Admins.',
  // Room name without own and shared name - its number among the person's rooms
  'companies.numbered': 'Raum {n}',
  // Room owner change: {who}, {by} - names (HTML), {title} - room name in quotes
  'companies.owner.transferred': '👑 <b>Dir wurden die Inhaberrechte des Raums übertragen.</b> Jetzt ernennst und entfernst du Admins, setzt Runden zurück, löschst sie und öffnest die Kontrollansicht – alles in der App.',
  'companies.owner.returned': '👑 <b>{by}</b> hat dir den Raum {title} übergeben: Du leitest ihn wieder selbst.',
  'companies.owner.prevNext': 'ℹ️ Die Inhaberrechte des Raums liegen jetzt bei <b>{who}</b>. Du bleibst Admin.',
  'companies.owner.prevBot': 'ℹ️ Den Raum leitet wieder der Bot-Inhaber. Du bleibst Admin.',
  'companies.owner.byLink': '👑 <b>{who}</b> ist jetzt Inhaber des Raums {title}.',
  'companies.owner.byLinkUsername': '👑 <b>{who}</b> (@{username}) ist jetzt Inhaber des Raums {title}.',
  'companies.owner.passed': 'ℹ️ <b>{by}</b> hat die Inhaberrechte des Raums {title} übertragen: Neuer Inhaber ist <b>{who}</b>.',
  'companies.owner.notice': 'ℹ️ <b>{who}</b> ist jetzt Inhaber.',
  // Deleting an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': 'Der Inhaber hat einen Raum gelöscht, in dem du Admin warst: Es gab darin keine Runden.',
  'companies.deleted.yours': 'Der Bot-Inhaber hat einen Raum gelöscht, den du geleitet hast: Es gab darin keine Runden.',
  'companies.deleted.admin': 'Der Bot-Inhaber hat einen Raum gelöscht, in dem du Admin warst: Es gab darin keine Runden.',
  // Log: {title} - room name
  'companies.audit.byLink': 'per Link: {name}',
  'companies.audit.toBotOwner': '→ Bot-Inhaber',
  'companies.audit.ownerChanged': '«{title}»: {details}',
  'companies.audit.linkRevoked': '«{title}»: widerrufen',
  'companies.audit.linkCreated': '«{title}»: erstellt',
  'companies.audit.roomDeleted': '«{title}», Personen: {n}',
};
