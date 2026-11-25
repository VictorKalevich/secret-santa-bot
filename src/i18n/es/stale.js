// Spanish: texts of src/stale.js (warning before an abandoned event is finished automatically).
export default {
  // {when} is the finishing date, {why} stale.why.<reason>, {keep} stale.keep.<reason>
  'stale.warning': '⏳ <b>El evento {title} finalizará automáticamente el {when}.</b>\n{why}\n\n{keep}',
  'stale.openButton': '⚙️ Abrir el evento',
  // Why the event is considered abandoned
  'stale.why.empty': 'Todavía no se ha unido nadie, aparte del propietario y los administradores.',
  'stale.why.age': 'No tiene fecha de intercambio y se creó hace más de siete semanas.',
  // How to keep the event
  'stale.keep.empty': 'Si todavía necesitas el evento, invita a participantes o indica la fecha del intercambio: «Gestión» → «Ajustes».',
  'stale.keep.age': 'Si todavía necesitas el evento, indica la fecha del intercambio: «Gestión» → «Ajustes».',
  // Activity log detail of finish.warn: {why} is stale.logged.<reason>
  'stale.auditText': '{why}; finaliza el {when}',
  'stale.logged.date': 'la fecha del intercambio pasó',
  'stale.logged.empty': 'no se unió nadie aparte del propietario y los administradores',
  'stale.logged.age': 'sin fecha de intercambio',
};
