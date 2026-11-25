// Texts of src/pairs.js (060): draw, inserting, removing, cancelling, giftee swap
export default {
  // Reasons why the draw is impossible (pairs.reason.<problem type of draw.js>); {name} - participant name
  'pairs.reason.too_few': "Servono almeno 2 partecipanti.",
  'pairs.reason.ring_too_few': "Per il sorteggio circolare servono almeno 3 partecipanti, oppure disattivalo nelle impostazioni.",
  'pairs.reason.ring_impossible': "Sembra che con queste esclusioni non si possano evitare coppie reciproche. Riprova; se non funziona, togli qualche esclusione o disattiva il sorteggio circolare.",
  'pairs.reason.no_receivers': "{name} non può fare il regalo a nessuno: controlla le esclusioni.",
  'pairs.reason.no_givers': "Nessuno può fare il regalo a {name}: controlla le esclusioni.",
  'pairs.reason.search_exhausted': "Non è stato possibile trovare in fretta una combinazione: riprova. Se non funziona, togli qualche esclusione o disattiva il sorteggio circolare.",
  'pairs.reason.fixed_block': "Le coppie fisse sono d'ostacolo: con loro non si riesce ad assegnare tutti secondo le regole. {owner.nomCap} può togliere alcune coppie fisse.",
  'pairs.reason.too_strict': "Troppe esclusioni: non si riesce ad assegnare tutti rispettandole. Togli qualche esclusione.",
  // Draw
  'pairs.drawn': "🎄 <b>Il sorteggio dell'evento {title} è fatto!</b>\n\nApri l'app e guarda nella scheda «Destinatario» a chi fai il regalo. Non dirlo a nessuno 🤫",
  'pairs.drawnButton': "🎁 Scopri il destinatario",
  'pairs.drawFinished': "L'evento è concluso.",
  'pairs.drawRace': "Partecipanti o esclusioni sono cambiati durante il sorteggio: riprova.",
  'pairs.notDrawn': "Il sorteggio non è stato fatto.",
  // Pairs after the membership change: to the new participant and to a Santa with a new giftee
  'pairs.inserted': "🎄 <b>Sei in gioco!</b> Il sorteggio dell'evento {title} è stato fatto anche per te: guarda nella scheda «Destinatario» 🤫",
  'pairs.newWard': "🔄 I partecipanti dell'evento {title} sono cambiati e ora hai un <b>nuovo destinatario</b>. Guarda nella scheda «Destinatario».",
  'pairs.lookButton': "🎁 Guarda",
  // Removing and inserting a participant
  'pairs.notMember': "Questa persona non partecipa all'evento.",
  'pairs.removeBlocked': "Impossibile rimuovere il partecipante senza violare le esclusioni o il sorteggio circolare. Allenta le esclusioni.",
  'pairs.removed': "Ti hanno rimosso dall'evento {title}. Se è un errore, contatta il proprietario o un amministratore.",
  'pairs.alreadyInDraw': "Il partecipante è già nel sorteggio.",
  'pairs.insertBlocked': "Impossibile inserire il partecipante senza violare le regole: chi potrebbe cambiare destinatario ha già il regalo pronto, oppure le esclusioni lo impediscono. Puoi annullare il sorteggio nella zona pericolosa e rifarlo.",
  // Giftee swap (048): rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': "Uno dei due fa il regalo all'altro: dopo l'inversione qualcuno farebbe il regalo a se stesso.",
  'pairs.swapRule.exclusion': "Esclusioni: uno dei due farebbe il regalo a chi, per le esclusioni, non dovrebbe.",
  'pairs.swapRule.ring': "Sorteggio circolare: comparirebbe una coppia reciproca, due persone si farebbero il regalo a vicenda.",
  'pairs.swapRule.fixed': "Coppie fisse: l'inversione romperebbe una coppia che hai fissato.",
  'pairs.swapRule.history': "Coppie passate: uno dei due farebbe il regalo alla stessa persona dell'evento precedente.",
  'pairs.swapRevealed': "Il segreto è già svelato: i destinatari non si possono più cambiare.",
  'pairs.swapTwo': "Scegli due partecipanti diversi.",
  'pairs.notInDraw': "Il partecipante non è nel sorteggio.",
  'pairs.swapStale': "Le coppie sono già cambiate: riapri l'inversione.",
  'pairs.swapSelf': "Questi due non si possono invertire: scegli un'altra coppia.",
  'pairs.swapRulesChanged': "Le regole del sorteggio per questa inversione sono cambiate: ricontrolla.",
  'pairs.swapNotice': "🔄 Il proprietario ha modificato il sorteggio dell'evento {title}: ora hai un <b>nuovo destinatario</b>. La coppia precedente non vale più e la sua chat è stata eliminata. Guarda nella scheda «Destinatario».",
  // Draw cancel (007) and forced cancel (012)
  'pairs.cancelFinished': "L'evento è concluso: il sorteggio non si può annullare.",
  'pairs.cancelRevealed': "Il segreto è già svelato: il sorteggio non si può annullare.",
  'pairs.cancelBlocked': "Impossibile annullare: qualcuno ha già visto il proprio destinatario o è iniziata una chat.",
  'pairs.cancelled': "↩️ <b>Il sorteggio è stato annullato</b> nell'evento {title}. La tua letterina è salva. Quando ci sarà un nuovo sorteggio, il bot ti scriverà.",
  'pairs.forceCancelled': "↩️ Il proprietario <b>ha annullato il sorteggio</b> nell'evento {title}. La coppia precedente non vale più e le chat con Babbo Natale e con il destinatario sono state eliminate. La tua letterina è salva. Quando ci sarà un nuovo sorteggio, il bot ti scriverà.",
  // Log details
  'pairs.auditText.members': "partecipanti: {n}",
  'pairs.auditText.changed': "coppie modificate: {n}",
  'pairs.auditText.removed': "coppie eliminate: {n}",
};
