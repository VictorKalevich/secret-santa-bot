// Texts of src/events.js (060): creation, finishing, deletion, reset, invitations, reveal, reminders, announcements, event
// parameters
export default {
  'events.titleRule': "Il nome dell'evento deve avere da 1 a 80 caratteri.",
  // Creating (063): who can and the limit; {limit} - the limit per 12 months, {date} - when a slot frees up
  'events.createRight': "In questo bot possono creare eventi il proprietario del bot e le persone a cui l'ha permesso.",
  'events.limit': "In 12 mesi puoi creare al massimo {limit} eventi. Il prossimo potrai crearlo dal {date}.",
  // Common app button under a message about the event (also in src/pairs.js)
  'events.openButton': "🎁 Apri",
  // Finishing
  'events.alreadyFinished': "L'evento è già concluso.",
  'events.finished': "🏁 <b>L'evento {title} è concluso.</b> Grazie per aver giocato!\n\nLa letterina ora è di sola lettura. La chat resta aperta ancora 7 giorni (fino al {until}), poi sarà di sola lettura. La cronologia dell'evento resterà nell'app.",
  'events.finishedButton': "📚 Apri",
  // Deletion and full reset
  'events.deleted': "🗑 L'evento {title} è stato eliminato dal proprietario insieme a letterine e chat.",
  'events.alreadyDeleted': "L'evento è già stato eliminato.",
  'events.reset': "🎄 Il proprietario ha fatto ripartire da zero l'evento {title}. I dati precedenti sono stati eliminati. Per partecipare, chiedi un nuovo link d'invito.",
  'events.resetRace': "L'evento è già stato resettato o è cambiato durante il reset: aggiorna la schermata.",
  // Inviting participants of another event
  'events.registrationClosed': "Le iscrizioni sono chiuse: riaprile per poter invitare.",
  'events.setupFirst': "Prima apri la pagina di configurazione /setup (vedi README).",
  'events.invite': "📨 <b>Invito all'evento {title}</b> — Babbo Natale segreto.\nTocca il pulsante per partecipare.",
  'events.inviteButton': "🎄 Partecipa",
  'events.inviteAgain': "Gli inviti sono già stati inviati: potrai ripetere tra un minuto.",
  // Reveal: {name} - Santa's name
  'events.alreadyRevealed': "Il segreto è già stato svelato.",
  'events.revealed': "🎅 <b>Il segreto è svelato!</b>\n\nNell'evento {title} il tuo Babbo Natale segreto è <b>{name}</b>. Buone feste! 🎄",
  // Reminders: empty letter (with and without a deadline)
  'events.remindAgain': "Il promemoria è già stato inviato: potrai ripetere tra un minuto.",
  'events.remindUnfilled': "⏰ Promemoria: la tua letterina a Babbo Natale nell'evento {title} è ancora vuota. Compilala, così sarà più facile scegliere il regalo.",
  'events.remindUnfilledBy': "⏰ Promemoria: la tua letterina a Babbo Natale nell'evento {title} è ancora vuota. Compilala entro il <b>{date}</b>, così sarà più facile scegliere il regalo.",
  // Announcements (007)
  'events.announceFinished': "L'evento è concluso: non si possono più inviare annunci.",
  'events.announceEmpty': "Scrivi il testo dell'annuncio.",
  'events.announcement': "📣 <b>Annuncio · {title}</b>\n\n{text}",
  'events.announcementButton': "📌 Apri l'evento",
  'events.announceAgain': "Questo annuncio è già stato inviato.",
  // Parameters
  'events.ringAfterDraw': "Dopo il sorteggio non si può più cambiare il sorteggio circolare.",
  // Log details
  'events.auditText.fromTemplate': "dal modello «{title}»",
  'events.auditText.deleted': "«{title}», partecipanti: {n}",
  'events.auditText.reset': "partecipanti rimossi: {n}",
  'events.auditText.invited': "da «{title}», invitati: {n}",
  'events.auditText.pairs': "coppie: {n}",
  'events.auditText.received': "recapitati: {n}",
  'events.auditText.settings': "impostazioni",
  'events.auditText.ring': "sorteggio circolare: {state}",
  'events.auditText.avoidPrevious': "non ripetere le coppie passate: {state}",
  'events.auditText.on': "attivo",
  'events.auditText.off': "disattivo",
  'events.auditText.registrationOpen': "aperte",
  'events.auditText.registrationClosed': "chiuse",
};
