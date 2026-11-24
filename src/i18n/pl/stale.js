// Texts of src/stale.js (060): warning about automatic finishing of an abandoned event (056)
export default {
  // {when} — finishing date, {why} — stale.why.<reason>, {keep} — stale.keep.<reason>
  'stale.warning': '⏳ <b>Wydarzenie {title} zakończy się automatycznie {when}.</b>\n{why}\n\n{keep}',
  'stale.openButton': '⚙️ Otwórz wydarzenie',
  // Why the event looks abandoned
  'stale.why.date': 'Data wręczenia ({date}) już minęła.',
  'stale.why.empty': 'Nikt jeszcze do niego nie dołączył poza właścicielem i administratorami.',
  'stale.why.age': 'Nie ma daty wręczenia, a zostało utworzone ponad trzy miesiące temu.',
  // How to keep the event
  'stale.keep.date': 'Jeśli wydarzenie jest jeszcze potrzebne — przesuń datę wręczenia: „Zarządzanie” → „Ustawienia”.',
  'stale.keep.empty': 'Jeśli wydarzenie jest jeszcze potrzebne — zaproś uczestników lub ustaw datę wręczenia: „Zarządzanie” → „Ustawienia”.',
  'stale.keep.age': 'Jeśli wydarzenie jest jeszcze potrzebne — ustaw datę wręczenia: „Zarządzanie” → „Ustawienia”.',
  // finish.warn log detail: {why} — stale.logged.<reason>
  'stale.auditText': '{why}; zakończy się {when}',
  'stale.logged.date': 'data wręczenia minęła',
  'stale.logged.empty': 'nikt nie dołączył poza właścicielem i administratorami',
  'stale.logged.age': 'brak daty wręczenia',
};
