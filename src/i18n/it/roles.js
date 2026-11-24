// Texts of src/roles.js (060): bot owner, admins, participation transfer. {name}, {from}, {to}, {actor} in messages - names
// (HTML)
export default {
  // App button under a message about new rights (also for a new room owner)
  'roles.openButton': "🛠 Apri",
  // Bot owner rights
  'roles.botOwner.byLink': "⚠️ Il ruolo di proprietario del bot è passato a <b>{name}</b> tramite il link della pagina di configurazione. Resti amministratore.\n\nSe non l'hai fatto tu e non era concordato, cambia ADMIN_SECRET (vedi README), apri la pagina di configurazione e usa il nuovo link del proprietario.",
  'roles.botOwner.transferred': "👑 <b>Ora sei il proprietario del bot.</b> Nomini e revochi gli amministratori nella sezione «Proprietario e amministratori» della schermata principale dell'app.",
  'roles.botOwner.notice': "ℹ️ <b>{name}</b> è ora il proprietario del bot.",
  // Owner rights transfer (bot and room)
  'roles.transferTarget': "Il ruolo di proprietario si può cedere solo a una persona iscritta.",
  'roles.alreadyOwnerSelf': "Sei già il proprietario.",
  'roles.alreadyTransferred': "Il ruolo di proprietario è già stato ceduto.",
  // Admins
  'roles.alreadyAdmin': "Ha già il ruolo di amministratore.",
  'roles.notAdmin': "Non è un amministratore.",
  'roles.grantUnregistered': "Si può nominare solo una persona iscritta.",
  'roles.revokeOwner': "Il ruolo di proprietario non si può revocare: prima cedilo a qualcun altro.",
  'roles.granted': "🛠 <b>Il proprietario ti ha nominato amministratore.</b>\n\nOra puoi creare e gestire eventi: inviti, esclusioni, sorteggio, promemoria. Le coppie può vederle solo il proprietario nella vista riservata.",
  'roles.grantedNotice': "ℹ️ <b>{name}</b> è ora amministratore.",
  'roles.revoked': "Il proprietario ti ha tolto il ruolo di amministratore. Come partecipante continui a giocare come sempre.",
  'roles.revokedNotice': "ℹ️ <b>{name}</b> non è più amministratore.",
  // Participation transfer to a new account
  'roles.transfer.twoRecords': "Scegli due profili diversi.",
  'roles.transfer.staffTarget': "Non si può trasferire la partecipazione sull'account del proprietario o di un amministratore.",
  'roles.transfer.noOld': "Profilo precedente non trovato.",
  'roles.transfer.unregistered': "Il nuovo account deve completare l'iscrizione (scrivere il nome al bot).",
  'roles.transfer.inDraw': "Il nuovo account partecipa già al sorteggio dell'evento «{title}»: scegli un altro profilo.",
  'roles.transfer.toNew': "🔁 Il proprietario ha trasferito su questo account la tua partecipazione a «Babbo Natale segreto»: letterine, destinatari, chat e cronologia degli eventi sono salvi.",
  'roles.transfer.toOld': "🔁 La tua partecipazione a «Babbo Natale segreto» è stata trasferita sull'account <b>{to}</b>. Se non l'hai chiesto tu, contatta il proprietario.",
  'roles.transfer.notice': "🔁 <b>{actor}</b> ha trasferito la partecipazione di <b>{from}</b> sull'account <b>{to}</b>.",
  // Log: new owner; transfer "old record -> new"
  'roles.audit.newOwner': "→ {name}",
  'roles.audit.accountMoved': "{from} → {to}",
};
