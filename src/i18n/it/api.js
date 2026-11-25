// Texts of src/api.js (060): check pipeline and action handlers. {owner.nom}, {owner.dat} - "the owner" or "the bot owner"
// (ownerWord of the event) in the needed form; {word} - the confirmation word of the action.
export default {
  'api.badInitData': "Impossibile verificare l'accesso. Riapri l'app dalla chat con il bot.",
  'api.unknownAction': "Azione sconosciuta",
  'api.noEvent': "Evento non trovato.",
  // What is not allowed in a finished event (finished field of the action table)
  'api.closed': "L'evento è concluso e non si può più modificare (restano visualizzazione, rivelazione ed eliminazione).",
  'api.letterClosed': "L'evento è concluso: ora la letterina è di sola lettura.",
  // Confirmation word (confirm field): refusal without the word
  'api.confirm.delete': "Per eliminare, scrivi la parola {word}.",
  'api.confirm.leave': "Per uscire, scrivi la parola {word}.",
  'api.confirm.cancel': "Per annullare, scrivi la parola {word}.",
  'api.confirm.reset': "Per il reset completo, scrivi la parola {word}.",
  'api.confirm.vault': "Per la vista riservata, scrivi la parola {word}.",
  // Refusal to a non-owner (owner field)
  'api.owner.roles': "Solo {owner.nom} può nominare e revocare gli amministratori.",
  'api.owner.vault': "La vista riservata è accessibile solo {owner.dat}.",
  'api.owner.swap': "Solo {owner.nom} può cambiare i destinatari dopo il sorteggio.",
  'api.owner.transfer': "Solo {owner.nom} può cedere la proprietà dell'evento.",
  'api.owner.insert': "Solo {owner.nom} può inserire qualcuno nel sorteggio già fatto.",
  'api.owner.fixed': "Solo {owner.nom} può fissare le coppie.",
  'api.owner.forceCancel': "Solo {owner.nom} può forzare l'annullamento del sorteggio.",
  'api.owner.eventDelete': "Solo {owner.nom} può eliminare l'evento.",
  'api.owner.reset': "Solo {owner.nom} può fare il reset completo.",
  'api.botOwner.transfer': "Solo il proprietario del bot può trasferire la partecipazione su un nuovo account.",
  'api.botOwner.rename': "Solo il proprietario del bot può rinominare una persona.",
  'api.botOnly': "Solo per il proprietario del bot.",
  // Handlers
  'api.nameRule': "Il nome deve avere da 1 a 40 caratteri",
  // 061: language choice - code not in the bot's language list
  'api.lang.unknown': "Questa lingua non esiste.",
  'api.templateNotFound': "Modello non trovato.",
  'api.memberNotFound': "Partecipante non trovato",
  'api.ownerNotTransferred': "Il profilo del proprietario non si trasferisce: il proprietario recupera l'accesso con un nuovo link del proprietario (cambia ADMIN_SECRET → pagina /setup).",
  'api.removeSelf': "Non puoi rimuoverti da qui: disattiva «Partecipo».",
  'api.removeOwner': "Il proprietario non può essere rimosso dall'evento. Prima deve cedere il ruolo di proprietario.",
  'api.removeAdmin': "Solo {owner.nom} può rimuovere un amministratore.",
  'api.drawDone': "Il sorteggio è già stato fatto.",
  'api.chooseOtherEvent': "Scegli un altro evento.",
  'api.inviteFinished': "L'evento è concluso: non si possono più invitare persone.",
};
