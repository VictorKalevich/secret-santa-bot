// Spanish: app part 03-home (the "My events" home screen and the "New event" sheet).
export default {
  // Leaving an event or a tab: asks only about what will not be saved by itself
  'app.home.unsaved': 'La carta o la dirección no están guardadas. ¿Salir sin guardar?',
  // Error screen on an event: back to the list
  'app.home.toEvents': 'Volver a los eventos',
  // Common labels
  'app.home.you': '  (tú)',
  // Event state: list labels; "en curso" also in the Info status row
  'app.home.finished': 'finalizado',
  'app.home.active': 'en curso',
  'app.home.notMember': 'no participas',
  // Home screen (063): ongoing and finished events; {n} — number of finished ones
  'app.home.greet': '¡Hola, {name}!',
  'app.home.going': 'En curso',
  'app.home.done': 'Finalizados · {n}',
  'app.home.empty.create': 'Todavía no hay eventos. Crea el tuyo con el botón de abajo o pide un enlace de invitación a un evento.',
  'app.home.empty.join': 'Todavía no participas en ningún evento. Pide un enlace de invitación a un evento.',
  // The bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': 'Estás aquí como propietario del bot: no apareces en las listas del evento y no recibes los mensajes para los administradores. Tus cambios quedan en el registro del evento.',
  // New event (007: from a template; 063: the creator is the owner, limit); {year} — next year
  'app.home.create.button': '🎄 Crear evento',
  'app.home.create.title': 'Nuevo evento',
  'app.home.create.hint': 'El evento tendrá sus propios participantes, enlace de invitación, cartas y sorteo. Serás su propietario y podrás nombrar administradores.',
  'app.home.create.name': 'Nombre del evento',
  'app.home.create.placeholder': 'Por ejemplo: Año Nuevo {year} — familia',
  'app.home.create.noTemplate': 'Sin plantilla, desde cero',
  'app.home.create.fromTemplate': 'Con plantilla: {title}',
  'app.home.create.invite': 'Invitar a los participantes de la plantilla',
  'app.home.create.templateHint': 'De la plantilla se copian el presupuesto, el lugar, las notas, las reglas del sorteo y las exclusiones. Las fechas no.',
  'app.home.create.participate': 'Yo también participo',
  // Limit (063): {n} — how many more; {limit} — the limit for 12 months, {date} — when a slot frees up
  'app.home.create.left': {
    one: 'Puedes crear {n} evento más en 12 meses.',
    other: 'Puedes crear {n} eventos más en 12 meses.',
  },
  'app.home.create.full': 'En 12 meses puedes crear como máximo {limit} eventos. El siguiente, a partir del {date}.',
  'app.home.create.done': '🎄 Evento creado',
  'app.home.create.doneInvited': '🎄 Evento creado, invitaciones: {count}',
  'app.home.create.doneInviteError': '🎄 Evento creado. {error}',
};
