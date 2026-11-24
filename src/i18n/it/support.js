// Texts of src/support.js (060): participant tickets to the organizers (012). {name}, {author}, {to} - names (HTML already
// escaped), {title} - event title in quotes, {text} - message text.
export default {
  // Refusals
  'support.noRecipients': "Al momento non c'è nessuno che possa rispondere al ticket.",
  'support.closed': "Il ticket è già chiuso.",
  'support.notFound': "Ticket non trovato.",
  'support.ownThread': "Questo è il tuo ticket: può prenderlo in carico qualcun altro.",
  'support.sendFailed': "Invio non riuscito: riprova.",
  'support.noOpen': "Non ci sono ticket aperti.",
  'support.hidden': "Il ticket è gestito da {name}: i messaggi li vedono solo questa persona e il proprietario.",
  'support.alreadyTaken': "{name} ha già preso in carico il ticket.",
  'support.takeOwn': "Non puoi prendere in carico il tuo ticket.",
  'support.ledBy': "Il ticket è gestito da {name}.",
  'support.passRights': "Il ticket può passarlo chi lo gestisce o il proprietario.",
  'support.passTarget': "Il ticket si può passare al proprietario o a un altro amministratore.",
  'support.alreadyLed': "Il ticket è già gestito da {name}.",
  'support.passRace': "Il ticket è cambiato proprio mentre agivi: aggiorna la schermata e riprova.",
  'support.closeRights': "Il ticket può chiuderlo chi lo gestisce o il proprietario.",
  // Assignee without a name (event screen counters)
  'support.assigneeFallback': "un responsabile",
  // Buttons under notifications
  'support.openButton': "💬 Apri",
  'support.takeButton': "🙋 Prendi in carico",
  // Who answered or closed - to the participant ({role})
  'support.role.owner': "Il proprietario",
  'support.role.admin': "L'amministratore",
  // Notifications to the organizers
  'support.notice.opened': "🆘 <b>{name}</b> chiede aiuto nell'evento {title}:\n\n{text}",
  'support.notice.added': "💬 <b>{name}</b> aggiunge al ticket ({title}):\n\n{text}",
  'support.notice.writes': "💬 <b>{name}</b> scrive nel ticket ({title}):\n\n{text}",
  'support.notice.closedByUser': "✅ <b>{name}</b> ha chiuso il ticket ({title}).",
  'support.notice.taken': "🙋 <b>{name}</b> ha preso in carico il ticket di <b>{author}</b> ({title}).",
  'support.notice.passedToYou': "↪️ <b>{name}</b> ti ha passato il ticket di <b>{author}</b> ({title}).",
  'support.notice.passed': "↪️ <b>{name}</b> ha passato il ticket di <b>{author}</b> ({title}): ora lo gestisce <b>{to}</b>.",
  'support.notice.closed': "✅ <b>{name}</b> ha chiuso il ticket di <b>{author}</b> ({title}).",
  'support.notice.returned': "🔄 Il ticket di <b>{author}</b> ({title}) è di nuovo libero.",
  // Notifications to the participant
  'support.user.taken': "🙋 <b>{name}</b> ha preso in carico il tuo ticket nell'evento {title}: la risposta arriverà qui.",
  'support.user.reply': "💬 {role} <b>{name}</b> risponde ({title}):\n\n{text}",
  'support.user.passed': "↪️ Ora il tuo ticket nell'evento {title} è gestito da <b>{name}</b>.",
  'support.user.closed': "✅ {role} <b>{name}</b> ha chiuso il tuo ticket nell'evento {title}. Se hai ancora bisogno, scrivi di nuovo.",
  'support.user.returned': "🔄 Il tuo ticket nell'evento {title} è di nuovo in attesa di risposta.",
};
