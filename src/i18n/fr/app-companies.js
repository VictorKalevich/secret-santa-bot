// Texts of app part 04-companies (060): "Rooms" screen, "Room" sheet, owner link, bot owner rights.
// In texts for people - "room" (059)
export default {
  // Person's role in a room row
  // "Rooms" screen
  'app.companies.title': "Salons",
  'app.companies.empty': "Aucun salon pour l'instant. Crée le tien — ou demande un lien d'invitation à un événement.",
  'app.companies.emptyBotOwner': "Aucun salon pour l'instant.",
  'app.companies.create': "🚪 Créer un salon",
  'app.companies.ownLimit': "Tu peux gérer au plus deux salons à toi — transmets-en un ou supprime-le.",
  'app.companies.botLog': "📜 Journal du bot",
  // Room row: who is the owner, how many events; buttons
  'app.companies.about': "Propriétaire : {owner} · événements : {events}",
  'app.companies.aboutIdle': "Propriétaire : {owner} · événements : {events} · aucun en cours",
  'app.companies.roomName': "Nom du salon",
  'app.companies.ownName': "Nom personnel",
  'app.companies.settings': "Salon",
  // Name sheet
  'app.companies.label.field': "Nom",
  'app.companies.label.shared': "Tous les membres du salon voient ce nom.",
  'app.companies.label.botOwner': "Le nom du salon n'est visible que par toi, propriétaire du bot.",
  'app.companies.label.own': "Ce nom n'est visible que par toi.",
  'app.companies.label.saved': "Nom enregistré",
  // New room
  'app.companies.new.title': "Nouveau salon",
  'app.companies.new.placeholder': "Par exemple : Travail",
  'app.companies.new.done': "🚪 Salon créé",
  'app.companies.new.hintOwn': "Tu deviendras propriétaire du salon : tu crées des événements, invites des gens et nommes des administrateurs. Tous les membres du salon verront son nom.",
  'app.companies.new.hintBot': "Un salon a ses propres membres, événements et administrateurs. Tu peux le gérer toi-même ou le confier à un propriétaire via un lien.",
  // Bot owner's "Room" sheet: who runs it
  'app.companies.lead.title': "Qui gère",
  'app.companies.lead.you': "Toi",
  'app.companies.lead.botRun': "Ce salon n'a pas de propriétaire : c'est toi qui le gères.",
  'app.companies.lead.owner': "Propriétaire du salon : administrateurs, réinitialisation et suppression d'événements, vue de contrôle des paires.",
  'app.companies.lead.self': "Gérer moi-même",
  'app.companies.lead.selfConfirm': "Gérer le salon toi-même ? « {name} » restera administrateur.",
  'app.companies.lead.selfDone': "C'est de nouveau toi qui gères le salon",
  // Room owner link
  'app.companies.link.title': "🔗 Lien de propriétaire du salon",
  'app.companies.link.hint': "Lien à usage unique : la première personne qui l'ouvre devient propriétaire du salon et pourra voir les paires de ses événements. Envoie-le en privé.",
  'app.companies.link.active': "Le lien est actif. Impossible de le réafficher — tu peux en créer un nouveau.",
  'app.companies.link.copy': "📋 Copier",
  'app.companies.link.shareText': "👑 Lien de propriétaire du « Père Noël secret » : ouvre-le pour gérer ton salon.",
  'app.companies.link.create': "Créer un lien",
  'app.companies.link.renew': "En créer un nouveau",
  'app.companies.link.revoke': "Révoquer",
  'app.companies.link.revoked': "Lien révoqué",
  // Deleting an empty room (sheet with a confirmation word)
  'app.companies.delete.section': "Suppression",
  'app.companies.delete.hasEvents': "Le salon contient des événements — supprime-les d'abord.",
  'app.companies.delete.button': "🗑 Supprimer le salon",
  'app.companies.delete.title': "Supprimer le salon",
  'app.companies.delete.lines': ["ses membres et administrateurs ;", "le journal commun du salon."],
  'app.companies.delete.keepBot': "Le salon ne contient aucun événement. Son propriétaire et ses administrateurs recevront un message.",
  'app.companies.delete.keepOwn': "Le salon ne contient aucun événement. Ses administrateurs recevront un message.",
  'app.companies.delete.done': "Salon supprimé",
  // Pass the bot owner rights
  'app.companies.botOwner.pass': "👑 Transmettre les droits de propriétaire du bot",
  'app.companies.botOwner.title': "Droits de propriétaire du bot",
  'app.companies.botOwner.hint': "Le bot n'a qu'un propriétaire. Tu peux transmettre ces droits à une personne des salons que tu gères.",
  'app.companies.botOwner.choose': "À qui les transmettre…",
  'app.companies.botOwner.confirm': "Transmettre les droits de propriétaire du bot à « {name} » ? Cette personne créera et supprimera les salons et nommera leurs propriétaires. Tu resteras administrateur de tes salons.",
  'app.companies.botOwner.done': "👑 Droits de propriétaire du bot transmis",
};
