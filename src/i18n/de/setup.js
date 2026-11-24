// Texts of src/setup.js (061, German): setup page /setup, commands, menu button and bot descriptions.
// Paragraph markup (<code>, <b>) is part of the text
export default {
  'setup.title': 'Einrichtung',
  // Key form
  'setup.form.label': 'Einrichtungsschlüssel (Wert des Secrets ADMIN_SECRET)',
  'setup.form.clear': 'Feld «Einrichtungsschlüssel» leeren',
  'setup.form.submit': 'Bot einrichten',
  'setup.noSecret.title': 'ADMIN_SECRET fehlt',
  'setup.noSecret.text': 'Setze das Secret ADMIN_SECRET mit mindestens 8 Zeichen (siehe Anleitung).',
  'setup.start.title': '🎄 Bot einrichten',
  'setup.start.text': 'Gib den Einrichtungsschlüssel ein – den Wert, den du mit dem Befehl\n<code>npx wrangler secret put ADMIN_SECRET</code> festgelegt hast.',
  'setup.badKey.title': 'Falscher Schlüssel',
  'setup.badKey.text': 'Der Schlüssel passt nicht. Prüfe den Wert von ADMIN_SECRET.',
  // The owner link has already been used
  'setup.locked.title': '🔒 Seite gesperrt',
  'setup.locked.used': 'Der Inhaber-Link wurde bereits verwendet, deshalb gibt die Einrichtungsseite ihn nicht mehr aus und ändert die Bot-Einstellungen nicht mehr.',
  'setup.locked.unlock': 'Zum Entsperren (zum Beispiel, wenn der Link in falsche Hände geraten ist oder du die Inhaberrechte zurückholen musst) ändere den Schlüssel:',
  'setup.locked.then': 'Öffne dann diese Seite erneut und gib den neuen Schlüssel ein – es erscheint ein neuer Inhaber-Link, der alte funktioniert nicht mehr.',
  // Setup steps
  'setup.step.token': 'Bot-Token',
  'setup.step.webhook': 'Webhook',
  'setup.step.commands': 'Befehle',
  'setup.step.menuButton': 'App-Button',
  // 061: commands and descriptions in the other languages are sent in parts with people's requests
  'setup.profileLater': 'die übrigen Sprachen übermittelt der Bot in den nächsten Minuten an Telegram',
  'setup.failed': 'Fehlgeschlagen',
  // Commands, menu button and bot descriptions in Telegram
  'setup.command.start': 'Hauptmenü und meine Runden',
  'setup.command.language': 'Sprache des Bots',
  'setup.command.cancel': 'Eingabe abbrechen',
  'setup.menuButton': '🎁 Wichteln',
  'setup.description': '🎄 Privater Bot zum Wichteln: Wunschzettel, Auslosung mit Ausschlüssen, anonyme Fragen. Zutritt über einen Einladungslink zu einer Runde.',
  'setup.shortDescription': '🎄 Wichteln mit Freunden, Familie und Kollegen',
  // Result
  'setup.done.ok': '✅ Bot eingerichtet',
  'setup.done.problems': '⚠️ Es gibt Probleme',
  'setup.done.linkTitle': '1. Inhaber-Link',
  'setup.done.linkText': 'Öffne ihn in Telegram – der Bot macht dich zum <b>Bot-Inhaber</b>. Der Inhaber erstellt Runden, ernennt und entfernt\nAdmins in der App (Startbildschirm → «Inhaber und Admins») und kann die Kontrollansicht der Paare öffnen.',
  'setup.done.linkWarn': '⚠️ Der Link <b>funktioniert nur einmal</b>: Danach ist diese Seite gesperrt, bis du\nADMIN_SECRET änderst. Leite ihn niemandem weiter – wer ihn zuerst öffnet, wird Inhaber. Ist das passiert, ändere ADMIN_SECRET,\nöffne die Seite erneut und folge dem neuen Link. Solange der Link nicht verwendet wurde, kannst du die Seite erneut öffnen.',
  'setup.done.eventTitle': '2. Erstelle eine Runde',
  'setup.done.eventText': 'Tippe im Chat mit dem Bot auf «🎁 Wichteln» → «🎄 Erstellen». Jede Runde hat ihren eigenen Einladungslink – du kannst ihn\ndirekt in der App kopieren oder in einen Chat schicken (Tab «Verwaltung» der Runde).',
};
