// Texts of src/events.js (060): creation, finishing, deletion, reset, invitations, reveal, reminders, announcements,
// event parameters
export default {
  'events.titleRule': "Le nom de l'événement doit compter de 1 à 80 caractères.",
  // Common app button under an event message (also in src/pairs.js)
  'events.openButton': "🎁 Ouvrir",
  // Finishing
  'events.alreadyFinished': "L'événement est déjà terminé.",
  'events.finished': "🏁 <b>L'événement {title} est terminé.</b> Merci d'avoir joué !\n\nLa lettre au Père Noël est désormais en lecture seule. La conversation reste ouverte encore 7 jours (jusqu'au {until}), puis passera en lecture seule. L'historique de l'événement restera dans l'appli.",
  'events.finishedButton': "📚 Ouvrir",
  // Deletion and full reset
  'events.deleted': "🗑 L'événement {title} a été supprimé par le propriétaire, avec les lettres et les conversations.",
  'events.alreadyDeleted': "L'événement est déjà supprimé.",
  'events.reset': "🎄 Le propriétaire a recommencé l'événement {title} à zéro. Les anciennes données sont supprimées. Pour participer, demande un nouveau lien d'invitation.",
  'events.resetRace': "L'événement a déjà été réinitialisé ou a changé pendant la réinitialisation — actualise l'écran.",
  // Inviting participants of another event
  'events.registrationClosed': "Les inscriptions sont fermées — ouvre-les pour inviter.",
  'events.setupFirst': "Ouvre d'abord la page de configuration /setup (voir README).",
  'events.invite': "📨 <b>Invitation à l'événement {title}</b> — Père Noël secret.\nAppuie sur le bouton pour participer.",
  'events.inviteButton': "🎄 Participer",
  'events.inviteAgain': "Les invitations sont déjà envoyées — tu pourras recommencer dans une minute.",
  // Reveal: {mask} - Santa's mask (040), {name} - Santa's name
  'events.alreadyRevealed': "Le secret est déjà révélé.",
  'events.revealed': "🎅 <b>Le secret est révélé !</b>\n\nDans l'événement {title}, ton Père Noël secret est <b>{name}</b>. Joyeuses fêtes ! 🎄",
  'events.revealedMask': "🎅 <b>Le secret est révélé !</b>\n\nDans l'événement {title}, ton Père Noël secret « {mask} » est <b>{name}</b>. Joyeuses fêtes ! 🎄",
  // Reminders: empty letter (with and without deadline) and to Santas (with and without the gift date)
  'events.remindAgain': "Le rappel est déjà envoyé — tu pourras recommencer dans une minute.",
  'events.remindUnfilled': "⏰ Rappel : ta lettre au Père Noël dans l'événement {title} est encore vide. Remplis-la pour l'aider à choisir ton cadeau.",
  'events.remindUnfilledBy': "⏰ Rappel : ta lettre au Père Noël dans l'événement {title} est encore vide. Remplis-la avant le <b>{date}</b> pour l'aider à choisir ton cadeau.",
  'events.remindSantas': "🎁 Rappel pour le Père Noël ({title}) : le cadeau de ton destinataire est-il prêt ?\nQuand il le sera, coche-le dans l'onglet « Destinataire ».",
  'events.remindSantasDated': "🎁 Rappel pour le Père Noël ({title}) : le cadeau de ton destinataire est-il prêt ? Remise des cadeaux : <b>{date}</b>.\nQuand il le sera, coche-le dans l'onglet « Destinataire ».",
  // Announcements (007)
  'events.announceFinished': "L'événement est terminé — on ne peut plus y envoyer d'annonces.",
  'events.announceEmpty': "Écris le texte de l'annonce.",
  'events.announcement': "📣 <b>Annonce · {title}</b>\n\n{text}",
  'events.announcementButton': "📌 Ouvrir l'événement",
  'events.announceAgain': "Cette annonce est déjà envoyée.",
  // Parameters
  'events.ringAfterDraw': "Après le tirage, le tirage en cercle ne peut plus être modifié.",
  // Log details
  'events.auditText.fromTemplate': "sur le modèle « {title} »",
  'events.auditText.deleted': "« {title} », participants : {n}",
  'events.auditText.reset': "participants supprimés : {n}",
  'events.auditText.invited': "depuis « {title} », invités : {n}",
  'events.auditText.pairs': "paires : {n}",
  'events.auditText.received': "reçus : {n}",
  'events.auditText.settings': "paramètres",
  'events.auditText.ring': "tirage en cercle : {state}",
  'events.auditText.avoidPrevious': "ne pas répéter les paires passées : {state}",
  'events.auditText.on': "activé",
  'events.auditText.off': "désactivé",
  'events.auditText.registrationOpen': "ouvertes",
  'events.auditText.registrationClosed': "fermées",
};
