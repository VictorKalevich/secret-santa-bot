// Texts of src/roles.js (060): bot owner, event owner and admins (063), participation transfer. {name}, {from}, {to},
// {actor}, {who} in messages - names (HTML), {title} - the event title in quotes (HTML)
export default {
  // App button under a message about new rights
  'roles.openButton': "🛠 Apri",
  // Bot owner rights
  'roles.botOwner.byLink': "⚠️ Il ruolo di proprietario del bot è passato a <b>{name}</b> tramite il link della pagina di configurazione. I tuoi eventi restano tuoi.\n\nSe non l'hai fatto tu e non era concordato, cambia ADMIN_SECRET (vedi README), apri la pagina di configurazione e usa il nuovo link del proprietario.",
  'roles.botOwner.transferred': "👑 <b>Ora sei il proprietario del bot.</b> Registro del bot, tutti gli eventi e cessione del ruolo sono nell'app: ⚙️ «Impostazioni» → «Proprietario del bot».",
  'roles.botOwner.notice': "ℹ️ <b>{name}</b> è ora il proprietario del bot.",
  // Passing the bot owner rights
  'roles.transferTarget': "Il ruolo di proprietario si può cedere solo a una persona iscritta.",
  'roles.alreadyOwnerSelf': "Sei già il proprietario.",
  'roles.alreadyTransferred': "Il ruolo di proprietario è già stato ceduto.",
  // Event admins
  'roles.alreadyAdmin': "Ha già il ruolo di amministratore.",
  'roles.notAdmin': "Non è un amministratore.",
  'roles.grantMember': "Si può nominare solo un partecipante dell'evento.",
  'roles.revokeOwner': "Il ruolo di proprietario non si può revocare: prima cedi la proprietà dell'evento.",
  'roles.granted': "🛠 <b>Ti hanno nominato amministratore dell'evento {title}.</b>\n\nOra puoi gestirlo: inviti, esclusioni, sorteggio, promemoria. Le coppie può vederle solo il proprietario dell'evento nella vista riservata.",
  'roles.grantedNotice': "ℹ️ <b>{name}</b> è ora amministratore dell'evento {title}.",
  'roles.revoked': "Ti hanno tolto il ruolo di amministratore dell'evento {title}. Se ci partecipi, continui a giocare come sempre.",
  'roles.revokedNotice': "ℹ️ <b>{name}</b> non è più amministratore dell'evento {title}.",
  // Event ownership
  'roles.owner.already': "Ha già il ruolo di proprietario.",
  'roles.owner.target': "La proprietà si può cedere solo a un partecipante o a un amministratore dell'evento.",
  'roles.owner.alreadyPassed': "La proprietà è già stata ceduta.",
  'roles.owner.toNew': "👑 <b>Ora sei il proprietario dell'evento {title}.</b> Nomini gli amministratori, apri la vista riservata, resetti ed elimini l'evento: tutto nell'app.",
  'roles.owner.toPrev': "ℹ️ La proprietà dell'evento {title} è passata a <b>{who}</b>. Resti amministratore.",
  'roles.owner.notice': "ℹ️ Il proprietario dell'evento {title} ora è <b>{who}</b>.",
  // Participation transfer to a new account
  'roles.transfer.twoRecords': "Scegli due profili diversi.",
  'roles.transfer.staffTarget': "Non si può trasferire la partecipazione sull'account del proprietario o di un amministratore.",
  'roles.transfer.noOld': "Profilo precedente non trovato.",
  'roles.transfer.unregistered': "Il nuovo account deve completare l'iscrizione (scrivere il nome al bot).",
  'roles.transfer.inDraw': "Il nuovo account partecipa già al sorteggio dell'evento «{title}»: scegli un altro profilo.",
  'roles.transfer.toNew': "🔁 Il proprietario del bot ha trasferito su questo account la tua partecipazione a «Babbo Natale segreto»: letterine, destinatari, chat e cronologia degli eventi sono salvi.",
  'roles.transfer.toOld': "🔁 La tua partecipazione a «Babbo Natale segreto» è stata trasferita sull'account <b>{to}</b>. Se non l'hai chiesto tu, contatta il proprietario del bot.",
  'roles.transfer.notice': "🔁 <b>{actor}</b> ha trasferito la partecipazione di <b>{from}</b> sull'account <b>{to}</b>.",
  // Log: new owner; transfer "old record -> new"
  'roles.audit.newOwner': "→ {name}",
  'roles.audit.accountMoved': "{from} → {to}",
};
