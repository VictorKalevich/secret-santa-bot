// Texts of src/roles.js (061, German): bot owner, admins, moving participation. {name}, {from}, {to}, {actor} in messages
// are names (HTML)
export default {
  // App button under a message about new rights (also for a new room owner)
  'roles.openButton': '🛠 Öffnen',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ Die Bot-Inhaberrechte sind über den Link der Einrichtungsseite an <b>{name}</b> übergegangen. Du bleibst Admin.\n\nWarst du das nicht und war es nicht abgesprochen, ändere ADMIN_SECRET (siehe README), öffne die Einrichtungsseite und folge dem neuen Inhaber-Link.',
  'roles.botOwner.transferred': '👑 <b>Dir wurden die Bot-Inhaberrechte übertragen.</b> Jetzt ernennst und entfernst du Admins – im Bereich «Inhaber und Admins» auf dem Startbildschirm der App.',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> ist jetzt Bot-Inhaber.',
  // Transferring owner rights (bot and room)
  'roles.transferTarget': 'Die Inhaberrechte lassen sich nur an eine angemeldete Person übertragen.',
  'roles.alreadyOwnerSelf': 'Du bist bereits der Inhaber.',
  'roles.alreadyTransferred': 'Die Inhaberrechte wurden bereits übertragen.',
  // Admins
  'roles.alreadyAdmin': 'Diese Person ist bereits Admin.',
  'roles.notAdmin': 'Diese Person ist kein Admin.',
  'roles.grantUnregistered': 'Ernennen lässt sich nur eine angemeldete Person.',
  'roles.revokeOwner': 'Die Inhaberrechte lassen sich nicht entziehen. Übertrage sie zuerst.',
  'roles.granted': '🛠 <b>Der Inhaber hat dich zum Admin ernannt.</b>\n\nJetzt kannst du Runden erstellen und leiten: Einladungen, Ausschlüsse, Auslosung, Erinnerungen. Die Paare sieht nur der Inhaber in der Kontrollansicht.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> ist jetzt Admin.',
  'roles.revoked': 'Der Inhaber hat dir die Admin-Rechte entzogen. Als Teilnehmer spielst du ganz normal weiter.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> ist kein Admin mehr.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Wähle zwei verschiedene Einträge.',
  'roles.transfer.staffTarget': 'Teilnahmen lassen sich nicht auf das Konto des Inhabers oder eines Admins übertragen.',
  'roles.transfer.noOld': 'Alter Eintrag nicht gefunden.',
  'roles.transfer.unregistered': 'Das neue Konto muss die Anmeldung abschließen (dem Bot seinen Namen schreiben).',
  'roles.transfer.inDraw': 'Das neue Konto nimmt bereits an der Auslosung der Runde «{title}» teil – wähle einen anderen Eintrag.',
  'roles.transfer.toNew': '🔁 Der Inhaber hat deine Teilnahme am Wichteln auf dieses Konto übertragen: Wunschzettel, Wichtelkinder, Chats und der Verlauf der Runden bleiben erhalten.',
  'roles.transfer.toOld': '🔁 Deine Teilnahme am Wichteln wurde auf das Konto <b>{to}</b> übertragen. Falls du das nicht veranlasst hast, wende dich an den Inhaber.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> hat die Teilnahme von <b>{from}</b> auf das Konto <b>{to}</b> übertragen.',
  // Log: new owner; moving "old record -> new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
