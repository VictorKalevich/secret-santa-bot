// Texts of src/stale.js (060): warning about automatic finishing of an abandoned event (056). Reasons - by the owner's
// rules: empty (G), age (B); 064: only events without a date
export default {
  // {when} - finishing date, {why} - stale.why.<reason>, {keep} - stale.keep.<reason>
  'stale.warning': "⏳ <b>L'evento {title} si concluderà automaticamente il {when}.</b>\n{why}\n\n{keep}",
  'stale.openButton': "⚙️ Apri l'evento",
  // Why the event is considered abandoned
  'stale.why.empty': "Finora non si è iscritto nessuno, a parte il proprietario e gli amministratori.",
  'stale.why.age': 'Non ha una data per lo scambio dei regali ed è stato creato più di sette settimane fa.',
  // How to keep the event
  'stale.keep.empty': "Se l'evento serve ancora, invita i partecipanti o indica la data dello scambio dei regali: «Gestione» → «Impostazioni».",
  'stale.keep.age': "Se l'evento serve ancora, indica la data dello scambio dei regali: «Gestione» → «Impostazioni».",
  // Detail of the finish.warn log entry (stale.auditText): {why} - stale.logged.<reason>
  'stale.auditText': "{why}; si concluderà il {when}",
  'stale.logged.date': "data dello scambio passata",
  'stale.logged.empty': "nessun iscritto oltre al proprietario e agli amministratori",
  'stale.logged.age': "nessuna data dello scambio",
};
