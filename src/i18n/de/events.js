// Texts of src/events.js (061, German): creation, finishing, deletion, reset, invitations, reveal, reminders,
// announcements, round parameters
export default {
  'events.titleRule': 'Der Name der Runde muss 1 bis 80 Zeichen lang sein.',
  // Creating (063): who can and the limit; {limit} - the limit for 12 months, {date} - when a slot frees up
  'events.createRight': 'Runden erstellen dürfen in diesem Bot der Bot-Inhaber und die Personen, denen er es erlaubt hat.',
  'events.limit': 'In 12 Monaten kannst du höchstens {limit} Runden erstellen. Die nächste – ab dem {date}.',
  // Shared app button under a message about the round (also in src/pairs.js)
  'events.openButton': '🎁 Öffnen',
  // Finishing
  'events.alreadyFinished': 'Die Runde ist bereits beendet.',
  'events.finished': '🏁 <b>Die Runde {title} ist beendet.</b> Danke fürs Mitmachen!\n\nDer Wunschzettel ist jetzt nur noch lesbar. Der Chat bleibt noch 7 Tage offen (bis zum {until}), danach nur noch zum Lesen. Der Verlauf der Runde bleibt in der App erhalten.',
  'events.finishedButton': '📚 Öffnen',
  // Deletion and full reset
  'events.deleted': '🗑 Die Runde {title} wurde vom Inhaber gelöscht – samt Wunschzetteln und Chats.',
  'events.alreadyDeleted': 'Die Runde ist bereits gelöscht.',
  'events.reset': '🎄 Der Inhaber hat die Runde {title} neu gestartet. Die bisherigen Daten wurden gelöscht. Um mitzumachen, bitte um einen neuen Einladungslink.',
  'events.resetRace': 'Die Runde wurde bereits zurückgesetzt oder hat sich gleichzeitig geändert – aktualisiere die Ansicht.',
  // Inviting participants of another round
  'events.registrationClosed': 'Die Anmeldung ist geschlossen – öffne sie, um einzuladen.',
  'events.setupFirst': 'Öffne zuerst die Einrichtungsseite /setup (siehe README).',
  'events.invite': '📨 <b>Einladung zur Runde {title}</b> – Wichteln.\nTippe auf den Button, um mitzumachen.',
  'events.inviteButton': '🎄 Mitmachen',
  'events.inviteAgain': 'Die Einladungen sind bereits verschickt – wiederholen kannst du es in einer Minute.',
  // Reveal: {name} - Santa name
  'events.alreadyRevealed': 'Das Geheimnis ist bereits gelüftet.',
  'events.revealed': '🎅 <b>Das Geheimnis ist gelüftet!</b>\n\nDein Wichtel in der Runde {title} ist <b>{name}</b>. Frohes Fest! 🎄',
  // Reminders: empty wish list (with and without deadline) and to Santas (with and without gift date)
  'events.remindAgain': 'Die Erinnerung ist bereits verschickt – wiederholen kannst du es in einer Minute.',
  'events.remindUnfilled': '⏰ Erinnerung: Dein Wunschzettel in der Runde {title} ist noch leer. Füll ihn aus, damit dein Wichtel leichter ein Geschenk findet.',
  'events.remindUnfilledBy': '⏰ Erinnerung: Dein Wunschzettel in der Runde {title} ist noch leer. Füll ihn bis zum <b>{date}</b> aus, damit dein Wichtel leichter ein Geschenk findet.',
  'events.remindSantas': '🎁 Erinnerung für Wichtel ({title}): Ist das Geschenk für dein Wichtelkind schon bereit?\nSobald es bereit ist, markiere es im Tab «Wichtelkind».',
  'events.remindSantasDated': '🎁 Erinnerung für Wichtel ({title}): Ist das Geschenk für dein Wichtelkind schon bereit? Bescherung: <b>{date}</b>.\nSobald es bereit ist, markiere es im Tab «Wichtelkind».',
  // Announcements (007)
  'events.announceFinished': 'Die Runde ist beendet – Ankündigungen sind nicht mehr möglich.',
  'events.announceEmpty': 'Schreib den Text der Ankündigung.',
  'events.announcement': '📣 <b>Ankündigung · {title}</b>\n\n{text}',
  'events.announcementButton': '📌 Runde öffnen',
  'events.announceAgain': 'Diese Ankündigung wurde bereits verschickt.',
  // Parameters
  'events.ringAfterDraw': 'Nach der Auslosung lässt sich die Kreisauslosung nicht mehr ändern.',
  // Log details
  'events.auditText.fromTemplate': 'nach Vorlage «{title}»',
  'events.auditText.deleted': '«{title}», Teilnehmer: {n}',
  'events.auditText.reset': 'Teilnehmer entfernt: {n}',
  'events.auditText.invited': 'aus «{title}», eingeladen: {n}',
  'events.auditText.pairs': 'Paare: {n}',
  'events.auditText.received': 'erhalten: {n}',
  'events.auditText.settings': 'Einstellungen',
  'events.auditText.ring': 'Kreisauslosung: {state}',
  'events.auditText.avoidPrevious': 'frühere Paare nicht wiederholen: {state}',
  'events.auditText.on': 'an',
  'events.auditText.off': 'aus',
  'events.auditText.registrationOpen': 'offen',
  'events.auditText.registrationClosed': 'geschlossen',
};
