// Texts of src/companies.js (060): rooms - creation, names, room owner, owner link, deletion. Refusals about owner
// rights are shared with roles.js (keys roles.*)
export default {
  // Refusals
  'companies.ownLimit': "Tu peux gérer au plus deux salons à toi — transmets-en un ou supprime-le.",
  'companies.recent': "Un salon portant ce nom vient d'être créé.",
  'companies.nameRule': "Le nom du salon doit compter de 1 à 40 caractères.",
  'companies.labelRule': "Le nom doit compter 40 caractères au plus.",
  'companies.hasEvents': "Le salon contient des événements — supprime-les d'abord.",
  'companies.ownDelete': "Seul le propriétaire du salon peut le supprimer.",
  'companies.alreadyOwner': "Cette personne est déjà propriétaire.",
  // Room owner link (bot: /start own_<code>)
  'companies.ownerLinkGone': "Ce lien de propriétaire a déjà été utilisé ou révoqué. Demandes-en un nouveau.",
  'companies.newOwner': "👑 Tu es propriétaire de ton salon dans « Père Noël secret » : tu crées des événements, invites des gens et nommes des administrateurs.",
  // Room name without own and shared name - its number among the person's rooms
  'companies.numbered': "Salon {n}",
  // Room owner change: {who}, {by} - names (HTML), {title} - room name in quotes
  'companies.owner.transferred': "👑 <b>Tu as reçu les droits de propriétaire du salon.</b> Désormais, tu nommes et retires les administrateurs, réinitialises et supprimes les événements, ouvres la vue de contrôle — tout dans l'appli.",
  'companies.owner.returned': "👑 <b>{by}</b> t'a rendu le salon {title} : c'est de nouveau toi qui le gères.",
  'companies.owner.prevNext': "ℹ️ Les droits de propriétaire du salon sont désormais à <b>{who}</b>. Tu restes administrateur.",
  'companies.owner.prevBot': "ℹ️ Le salon est de nouveau géré par le propriétaire du bot. Tu restes administrateur.",
  'companies.owner.byLink': "👑 <b>{who}</b> est désormais propriétaire du salon {title}.",
  'companies.owner.byLinkUsername': "👑 <b>{who}</b> (@{username}) est désormais propriétaire du salon {title}.",
  'companies.owner.passed': "ℹ️ <b>{by}</b> a transmis les droits de propriétaire du salon {title} : le propriétaire est désormais <b>{who}</b>.",
  'companies.owner.notice': "ℹ️ <b>{who}</b> est désormais propriétaire.",
  // Deletion of an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': "Le propriétaire a supprimé un salon dont tu étais administrateur : il ne contenait aucun événement.",
  'companies.deleted.yours': "Le propriétaire du bot a supprimé un salon que tu gérais : il ne contenait aucun événement.",
  'companies.deleted.admin': "Le propriétaire du bot a supprimé un salon dont tu étais administrateur : il ne contenait aucun événement.",
  // Log: {title} - room name
  'companies.audit.byLink': "par lien : {name}",
  'companies.audit.toBotOwner': "→ propriétaire du bot",
  'companies.audit.ownerChanged': "« {title} » : {details}",
  'companies.audit.linkRevoked': "« {title} » : révoqué",
  'companies.audit.linkCreated': "« {title} » : créé",
  'companies.audit.roomDeleted': "« {title} », personnes : {n}",
};
