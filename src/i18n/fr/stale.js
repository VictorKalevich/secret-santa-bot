// Texts of src/stale.js (060): warning about auto-finishing an abandoned event (056). Reasons follow the owner's rules:
// empty (G), age (B); 064: only events without a date
export default {
  // {when} - finish date, {why} - stale.why.<reason>, {keep} - stale.keep.<reason>
  'stale.warning': "⏳ <b>L'événement {title} se terminera automatiquement le {when}.</b>\n{why}\n\n{keep}",
  'stale.openButton': "⚙️ Ouvrir l'événement",
  // Why the event is considered abandoned
  'stale.why.empty': "Personne ne l'a encore rejoint, à part le propriétaire et les administrateurs.",
  'stale.why.age': "Il n'a pas de date de remise des cadeaux et a été créé il y a plus de sept semaines.",
  // How to keep the event
  'stale.keep.empty': "Si l'événement est encore utile, invite des participants ou indique la date de remise : « Gestion » → « Paramètres ».",
  'stale.keep.age': "Si l'événement est encore utile, indique la date de remise : « Gestion » → « Paramètres ».",
  // Log detail of finish.warn (stale.auditText): {why} - stale.logged.<reason>
  'stale.auditText': "{why} ; se terminera le {when}",
  'stale.logged.date': "date de remise passée",
  'stale.logged.empty': "personne n'a rejoint, à part le propriétaire et les administrateurs",
  'stale.logged.age': "pas de date de remise",
};
