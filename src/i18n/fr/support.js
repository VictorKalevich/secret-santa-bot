// Texts of src/support.js (060): participant requests to organizers (012). {name}, {author}, {to} - names (HTML already
// escaped), {title} - event title in quotes, {text} - message text.
export default {
  // Refusals
  'support.noRecipients': "Personne ne peut répondre à la question pour le moment.",
  'support.closed': "La question est déjà fermée.",
  'support.notFound': "Question introuvable.",
  'support.ownThread': "C'est ta propre question — quelqu'un d'autre peut la prendre en charge.",
  'support.sendFailed': "Échec de l'envoi — réessaie.",
  'support.noOpen': "Aucune question ouverte.",
  'support.hidden': "{name} s'occupe de cette question — seuls cette personne et le propriétaire voient la conversation.",
  'support.alreadyTaken': "{name} a déjà pris la question en charge.",
  'support.takeOwn': "Tu ne peux pas prendre en charge ta propre question.",
  'support.ledBy': "{name} s'occupe de la question.",
  'support.passRights': "Seuls la personne responsable de la question et le propriétaire peuvent la transmettre.",
  'support.passTarget': "Tu peux la transmettre au propriétaire ou à un autre administrateur.",
  'support.alreadyLed': "{name} s'occupe déjà de la question.",
  'support.passRace': "La question a changé en même temps que cette action — actualise l'écran et réessaie.",
  'support.closeRights': "Seuls la personne responsable de la question et le propriétaire peuvent la fermer.",
  // Assignee without a name (event screen counters)
  'support.assigneeFallback': "responsable",
  // Buttons under notifications
  'support.openButton': "💬 Ouvrir",
  'support.takeButton': "🙋 Prendre",
  // Who replied or closed - to the participant ({role})
  'support.role.owner': "propriétaire",
  'support.role.admin': "administrateur",
  // Notifications to organizers
  'support.notice.opened': "🆘 <b>{name}</b> demande de l'aide ({title}) :\n\n{text}",
  'support.notice.added': "💬 <b>{name}</b> complète sa question ({title}) :\n\n{text}",
  'support.notice.writes': "💬 <b>{name}</b> écrit dans la question ({title}) :\n\n{text}",
  'support.notice.closedByUser': "✅ <b>{name}</b> a fermé sa question ({title}).",
  'support.notice.taken': "🙋 <b>{name}</b> a pris en charge la question de <b>{author}</b> ({title}).",
  'support.notice.passedToYou': "↪️ <b>{name}</b> t'a transmis la question de <b>{author}</b> ({title}).",
  'support.notice.passed': "↪️ <b>{name}</b> a transmis la question de <b>{author}</b> ({title}) — désormais, c'est <b>{to}</b> qui s'en occupe.",
  'support.notice.closed': "✅ <b>{name}</b> a fermé la question de <b>{author}</b> ({title}).",
  'support.notice.returned': "🔄 La question de <b>{author}</b> ({title}) n'a plus de responsable.",
  // Notifications to the participant
  'support.user.taken': "🙋 <b>{name}</b> a pris en charge ta question dans l'événement {title} — la réponse arrivera ici.",
  'support.user.reply': "💬 <b>{name}</b> ({role}) répond ({title}) :\n\n{text}",
  'support.user.passed': "↪️ C'est désormais <b>{name}</b> qui s'occupe de ta question dans l'événement {title}.",
  'support.user.closed': "✅ <b>{name}</b> ({role}) a fermé ta question dans l'événement {title}. Si le problème persiste, écris simplement à nouveau.",
  'support.user.returned': "🔄 Ta question dans l'événement {title} attend de nouveau une réponse.",
};
