// Texts of app part 04-companies (061, German): "Rooms" screen, "Room" sheet, owner link, bot owner rights.
// For people it is "room" (059)
export default {
  // Role of the person in a room row
  // "Rooms" screen
  'app.companies.title': 'Räume',
  'app.companies.empty': 'Noch keine Räume. Erstelle deinen eigenen – oder bitte um einen Einladungslink zu einer Runde.',
  'app.companies.emptyBotOwner': 'Noch keine Räume.',
  'app.companies.create': '🚪 Raum erstellen',
  'app.companies.ownLimit': 'Du kannst höchstens zwei eigene Räume leiten – übergib oder lösche einen davon.',
  'app.companies.botLog': '📜 Bot-Protokoll',
  // Room row: who is the owner, how many rounds; buttons "pencil" and "gear"
  'app.companies.about': 'Inhaber: {owner} · Runden: {events}',
  'app.companies.aboutIdle': 'Inhaber: {owner} · Runden: {events} · keine laufenden',
  'app.companies.roomName': 'Name des Raums',
  'app.companies.ownName': 'Name nur für dich',
  'app.companies.settings': 'Raum',
  // Name sheet
  'app.companies.label.field': 'Name',
  'app.companies.label.shared': 'Diesen Namen sehen alle Personen im Raum.',
  'app.companies.label.botOwner': 'Den Namen des Raums siehst nur du als Bot-Inhaber.',
  'app.companies.label.own': 'Diesen Namen siehst nur du.',
  'app.companies.label.saved': 'Name gespeichert',
  // New room
  'app.companies.new.title': 'Neuer Raum',
  'app.companies.new.placeholder': 'Zum Beispiel: Arbeit',
  'app.companies.new.done': '🚪 Raum erstellt',
  'app.companies.new.hintOwn': 'Du wirst Inhaber des Raums: Du erstellst Runden, lädst Leute ein und ernennst Admins. Den Namen sehen alle Personen im Raum.',
  'app.companies.new.hintBot': 'Ein Raum hat eigene Personen, Runden und Admins. Du kannst ihn selbst leiten oder per Link einem Inhaber übergeben.',
  // "Room" sheet of the bot owner: who leads
  'app.companies.lead.title': 'Wer leitet',
  'app.companies.lead.you': 'Du',
  'app.companies.lead.botRun': 'Der Raum hat keinen eigenen Inhaber: Du leitest ihn.',
  'app.companies.lead.owner': 'Inhaber des Raums: Admins, Zurücksetzen und Löschen von Runden, Kontrollansicht der Paare.',
  'app.companies.lead.self': 'Selbst leiten',
  'app.companies.lead.selfConfirm': 'Den Raum selbst leiten? «{name}» bleibt Admin.',
  'app.companies.lead.selfDone': 'Du leitest den Raum wieder selbst',
  // Room owner link
  'app.companies.link.title': '🔗 Inhaber-Link des Raums',
  'app.companies.link.hint': 'Der Link gilt nur einmal: Wer ihn zuerst öffnet, wird Inhaber des Raums und kann die Paare seiner Runden sehen. Schick ihn nur persönlich.',
  'app.companies.link.active': 'Der Link ist aktiv. Erneut anzeigen lässt er sich nicht – du kannst einen neuen erstellen.',
  'app.companies.link.copy': '📋 Kopieren',
  'app.companies.link.shareText': '👑 Inhaber-Link fürs Wichteln: Öffne ihn, um deinen eigenen Raum zu leiten.',
  'app.companies.link.create': 'Link erstellen',
  'app.companies.link.renew': 'Neuen erstellen',
  'app.companies.link.revoke': 'Widerrufen',
  'app.companies.link.revoked': 'Link widerrufen',
  // Deleting an empty room (sheet with a confirmation word)
  'app.companies.delete.section': 'Löschen',
  'app.companies.delete.hasEvents': 'Im Raum gibt es Runden – lösche sie zuerst.',
  'app.companies.delete.button': '🗑 Raum löschen',
  'app.companies.delete.title': 'Raum löschen',
  'app.companies.delete.lines': ['seine Personen und Admins;', 'das allgemeine Protokoll des Raums.'],
  'app.companies.delete.keepBot': 'Im Raum gibt es keine Runden. Sein Inhaber und die Admins bekommen eine Nachricht.',
  'app.companies.delete.keepOwn': 'Im Raum gibt es keine Runden. Seine Admins bekommen eine Nachricht.',
  'app.companies.delete.done': 'Raum gelöscht',
  // Transfer the bot owner rights
  'app.companies.botOwner.pass': '👑 Bot-Inhaberrechte übertragen',
  'app.companies.botOwner.title': 'Bot-Inhaberrechte',
  'app.companies.botOwner.hint': 'Es gibt nur einen Bot-Inhaber. Übertragen kannst du die Rechte an eine Person aus den Räumen, die du leitest.',
  'app.companies.botOwner.choose': 'An wen übertragen…',
  'app.companies.botOwner.confirm': 'Bot-Inhaberrechte an «{name}» übertragen? Diese Person erstellt und löscht dann Räume und ernennt deren Inhaber. Du bleibst Admin deiner Räume.',
  'app.companies.botOwner.done': '👑 Bot-Inhaberrechte übertragen',
};
