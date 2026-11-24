// Texts of src/membership.js (060): joining, join requests, families, "I take part", leaving
export default {
  // Families (008): rules and frozen membership while a drawn event is running (009)
  'membership.familyNameRule': "Il nome della famiglia deve avere da 1 a 40 caratteri.",
  'membership.familySize': "Una famiglia deve avere da 2 a {max} persone.",
  'membership.familyNotFound': "Famiglia non trovata.",
  'membership.memberNotFound': "Partecipante non trovato.",
  'membership.alreadyInFamily': "{name} fa già parte della famiglia «{family}».",
  'membership.familyFrozen': "La famiglia non si può modificare finché è in corso l'evento «{title}» con il sorteggio già fatto: altrimenti dalle sostituzioni si potrebbero dedurre le coppie. Potrai modificarla quando l'evento sarà concluso.",
  // Log: family - name and members, "I take part"
  'membership.audit.familySave': "«{name}»: {people}",
  'membership.audit.familyDelete': "«{name}»",
  'membership.audit.isParticipant': "partecipa",
  'membership.audit.notParticipant': "non partecipa",
  'membership.afterDraw': "Dopo il sorteggio non si può. Chiedi {owner.dat} di inserirti.",
  // Participant leaving (035)
  'membership.leaveAfterDraw': "Il sorteggio è già stato fatto. Per uscire, rivolgiti al proprietario o agli amministratori.",
  'membership.leaveFinished': "L'evento è concluso: non puoi più uscirne.",
  'membership.leaveNotice': "🚪 <b>{name}</b> esce dall'evento {title}.",
  'membership.openEventButton': "🛠 Apri l'evento",
  // Bringing back removed people (010)
  'membership.notRemoved': "Questa persona non è tra i rimossi.",
  // Joining and join requests (008)
  'membership.joinedNotice': "👋 <b>{name}</b> si unisce all'evento {title}",
  'membership.request': "🙋 <b>{name}</b> vuole partecipare all'evento {title}.",
  'membership.requestWithUsername': "🙋 <b>{name}</b> (@{username}) vuole partecipare all'evento {title}.",
  'membership.acceptButton': "✅ Accetta",
  'membership.rejectButton': "❌ Rifiuta",
  'membership.requestNotFound': "Richiesta non trovata.",
  'membership.requestDecided': "La richiesta è già stata esaminata.",
  'membership.approveFinished': "L'evento è concluso: non si può più accettare nessuno.",
  'membership.approveClosed': "Le iscrizioni all'evento «{title}» sono chiuse: riaprile per accettare la richiesta.",
  // Decision on a request: to the participant and to the other admins
  'membership.approvedAfterDraw': "🎉 Richiesta accettata: sei nell'evento {title}! Il sorteggio è già stato fatto: {owner.nom} ti inserirà e il bot ti avviserà. Intanto scrivi la letterina a Babbo Natale.",
  'membership.approved': "🎉 Richiesta accettata: sei nell'evento {title}! Apri l'app e scrivi la letterina al tuo Babbo Natale segreto.",
  'membership.requestRejected': "La tua richiesta di partecipazione all'evento {title} è stata rifiutata. Se è un errore, contatta il proprietario o un amministratore.",
  'membership.approvedBy': "✅ <b>{by}</b> ha accettato la richiesta di <b>{name}</b> per l'evento {title}.",
  'membership.rejectedBy': "❌ <b>{by}</b> ha rifiutato la richiesta di <b>{name}</b> per l'evento {title}.",
};
