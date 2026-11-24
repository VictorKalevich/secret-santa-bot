// Texts of src/support.js (061, German): participant requests to the organizers (012). {name}, {author}, {to} - names
// (HTML already escaped), {title} - round title in quotes, {text} - message text.
export default {
  // Refusals
  'support.noRecipients': 'Gerade kann niemand auf das Anliegen antworten.',
  'support.closed': 'Das Anliegen ist bereits geschlossen.',
  'support.notFound': 'Anliegen nicht gefunden.',
  'support.ownThread': 'Das ist dein eigenes Anliegen – übernehmen kann es jemand anderes.',
  'support.sendFailed': 'Senden fehlgeschlagen – versuch es noch einmal.',
  'support.noOpen': 'Kein offenes Anliegen.',
  'support.hidden': '{name} bearbeitet das Anliegen – den Verlauf sehen nur diese Person und der Inhaber.',
  'support.alreadyTaken': '{name} hat das Anliegen bereits übernommen.',
  'support.takeOwn': 'Dein eigenes Anliegen kannst du nicht übernehmen.',
  'support.ledBy': '{name} bearbeitet das Anliegen.',
  'support.passRights': 'Weitergeben kann das Anliegen nur, wer es bearbeitet, oder der Inhaber.',
  'support.passTarget': 'Weitergeben kannst du es an den Inhaber oder einen anderen Admin.',
  'support.alreadyLed': '{name} bearbeitet das Anliegen bereits.',
  'support.passRace': 'Das Anliegen hat sich gleichzeitig mit dieser Aktion geändert – aktualisiere die Ansicht und versuch es noch einmal.',
  'support.closeRights': 'Schließen kann das Anliegen nur, wer es bearbeitet, oder der Inhaber.',
  // Assignee without a name (round screen counters)
  'support.assigneeFallback': 'Admin',
  // Buttons under notifications
  'support.openButton': '💬 Öffnen',
  'support.takeButton': '🙋 Übernehmen',
  // Who replied or closed - to the participant ({role})
  'support.role.owner': 'Inhaber',
  'support.role.admin': 'Admin',
  // Notifications to the organizers
  'support.notice.opened': '🆘 <b>{name}</b> bittet in der Runde {title} um Hilfe:\n\n{text}',
  'support.notice.added': '💬 <b>{name}</b> ergänzt das Anliegen ({title}):\n\n{text}',
  'support.notice.writes': '💬 <b>{name}</b> schreibt im Anliegen ({title}):\n\n{text}',
  'support.notice.closedByUser': '✅ <b>{name}</b> hat das Anliegen geschlossen ({title}).',
  'support.notice.taken': '🙋 <b>{name}</b> hat das Anliegen von <b>{author}</b> übernommen ({title}).',
  'support.notice.passedToYou': '↪️ <b>{name}</b> hat dir das Anliegen von <b>{author}</b> weitergegeben ({title}).',
  'support.notice.passed': '↪️ <b>{name}</b> hat das Anliegen von <b>{author}</b> ({title}) weitergegeben – jetzt bearbeitet es <b>{to}</b>.',
  'support.notice.closed': '✅ <b>{name}</b> hat das Anliegen von <b>{author}</b> geschlossen ({title}).',
  'support.notice.returned': '🔄 Das Anliegen von <b>{author}</b> ({title}) ist wieder niemandem zugewiesen.',
  // Notifications to the participant
  'support.user.taken': '🙋 <b>{name}</b> hat dein Anliegen in der Runde {title} übernommen – die Antwort kommt hierher.',
  'support.user.reply': '💬 {role} <b>{name}</b> antwortet ({title}):\n\n{text}',
  'support.user.passed': '↪️ Dein Anliegen in der Runde {title} bearbeitet jetzt <b>{name}</b>.',
  'support.user.closed': '✅ {role} <b>{name}</b> hat dein Anliegen in der Runde {title} geschlossen. Ist noch etwas offen, schreib einfach wieder.',
  'support.user.returned': '🔄 Dein Anliegen in der Runde {title} wartet wieder auf eine Antwort.',
};
