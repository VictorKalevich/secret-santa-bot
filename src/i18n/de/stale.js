// Texts of src/stale.js (061, German): warning about auto-finishing an abandoned round (056). Reasons follow the
// owner's rules: empty (G), age (B); 064: only events without a date
export default {
  // {when} - finish date, {why} - stale.why.<reason>, {keep} - stale.keep.<reason>
  'stale.warning': '⏳ <b>Die Runde {title} wird am {when} automatisch beendet.</b>\n{why}\n\n{keep}',
  'stale.openButton': '⚙️ Runde öffnen',
  // Why the round is considered abandoned
  'stale.why.empty': 'Außer dem Inhaber und den Admins ist noch niemand beigetreten.',
  'stale.why.age': 'Sie hat kein Datum für die Bescherung und wurde vor mehr als sieben Wochen erstellt.',
  // How to keep the round
  'stale.keep.empty': 'Wird die Runde noch gebraucht, lade Teilnehmer ein oder lege ein Datum für die Bescherung fest: «Verwaltung» → «Einstellungen».',
  'stale.keep.age': 'Wird die Runde noch gebraucht, lege ein Datum für die Bescherung fest: «Verwaltung» → «Einstellungen».',
  // Log detail of finish.warn (stale.auditText): {why} - stale.logged.<reason>
  'stale.auditText': '{why}; wird am {when} beendet',
  'stale.logged.date': 'Bescherung vorbei',
  'stale.logged.empty': 'außer Inhaber und Admins niemand beigetreten',
  'stale.logged.age': 'kein Datum für die Bescherung',
};
