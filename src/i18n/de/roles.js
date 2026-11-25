// Texts of src/roles.js (061, German): bot owner, round owner and admins (063), moving participation. {name}, {from},
// {to}, {actor}, {who} in messages are names (HTML), {title} - round title in quotes (HTML)
export default {
  // App button under the message about new rights
  'roles.openButton': '🛠 Öffnen',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ Die Bot-Inhaberrechte sind über den Link der Einrichtungsseite an <b>{name}</b> übergegangen. Deine Runden bleiben bei dir.\n\nWarst du das nicht und war es nicht abgesprochen, ändere ADMIN_SECRET (siehe README), öffne die Einrichtungsseite und folge dem neuen Inhaber-Link.',
  'roles.botOwner.transferred': '👑 <b>Dir wurden die Bot-Inhaberrechte übertragen.</b> Bot-Protokoll, alle Runden und die Übertragung der Rechte findest du in der App: ⚙️ «Einstellungen» → «Bot-Inhaber».',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> ist jetzt Bot-Inhaber.',
  // Transferring bot owner rights
  'roles.transferTarget': 'Die Inhaberrechte lassen sich nur an eine angemeldete Person übertragen.',
  'roles.alreadyOwnerSelf': 'Du bist bereits der Inhaber.',
  'roles.alreadyTransferred': 'Die Inhaberrechte wurden bereits übertragen.',
  // Event admins
  'roles.alreadyAdmin': 'Diese Person ist bereits Admin.',
  'roles.notAdmin': 'Diese Person ist kein Admin.',
  'roles.grantMember': 'Ernennen lässt sich nur ein Teilnehmer der Runde.',
  'roles.revokeOwner': 'Die Inhaberrechte lassen sich nicht entziehen. Übertrage zuerst die Inhaberrechte der Runde.',
  'roles.granted': '🛠 <b>Du wurdest zum Admin der Runde {title} ernannt.</b>\n\nJetzt kannst du sie leiten: Einladungen, Ausschlüsse, Auslosung, Erinnerungen. Die Paare sieht nur der Inhaber der Runde in der Kontrollansicht.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> ist jetzt Admin der Runde {title}.',
  'roles.revoked': 'Dir wurden die Admin-Rechte der Runde {title} entzogen. Wenn du dort mitmachst, spielst du ganz normal weiter.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> ist kein Admin der Runde {title} mehr.',
  // Event ownership
  'roles.owner.already': 'Diese Person ist bereits Inhaber.',
  'roles.owner.target': 'Die Inhaberrechte lassen sich nur an einen Teilnehmer oder Admin der Runde übertragen.',
  'roles.owner.alreadyPassed': 'Die Inhaberrechte wurden bereits übertragen.',
  'roles.owner.toNew': '👑 <b>Du bist jetzt Inhaber der Runde {title}.</b> Du ernennst Admins, öffnest die Kontrollansicht, setzt die Runde zurück und löschst sie – alles in der App.',
  'roles.owner.toPrev': 'ℹ️ Die Inhaberrechte der Runde {title} liegen jetzt bei <b>{who}</b>. Du bleibst Admin.',
  'roles.owner.notice': 'ℹ️ Neuer Inhaber der Runde {title} ist <b>{who}</b>.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Wähle zwei verschiedene Einträge.',
  'roles.transfer.staffTarget': 'Teilnahmen lassen sich nicht auf das Konto des Inhabers oder eines Admins übertragen.',
  'roles.transfer.noOld': 'Alter Eintrag nicht gefunden.',
  'roles.transfer.unregistered': 'Das neue Konto muss die Anmeldung abschließen (dem Bot seinen Namen schreiben).',
  'roles.transfer.inDraw': 'Das neue Konto nimmt bereits an der Auslosung der Runde «{title}» teil – wähle einen anderen Eintrag.',
  'roles.transfer.toNew': '🔁 Der Bot-Inhaber hat deine Teilnahme am Wichteln auf dieses Konto übertragen: Wunschzettel, Wichtelkinder, Chats und der Verlauf der Runden bleiben erhalten.',
  'roles.transfer.toOld': '🔁 Deine Teilnahme am Wichteln wurde auf das Konto <b>{to}</b> übertragen. Falls du das nicht veranlasst hast, wende dich an den Bot-Inhaber.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> hat die Teilnahme von <b>{from}</b> auf das Konto <b>{to}</b> übertragen.',
  // Log: new owner; moving "old record -> new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
