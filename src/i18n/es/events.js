// Spanish: texts of src/events.js (creation, finishing, deletion, reset, invitations, reveal, reminders, announcements).
export default {
  'events.titleRule': 'El nombre del evento debe tener entre 1 y 80 caracteres.',
  // Creating (063): who can and the limit; {limit} — the limit for 12 months, {date} — when a slot frees up
  'events.createRight': 'En este bot pueden crear eventos el propietario del bot y las personas a las que él se lo permitió.',
  'events.limit': 'En 12 meses puedes crear como máximo {limit} eventos. El siguiente, a partir del {date}.',
  // Common app button under an event message
  'events.openButton': '🎁 Abrir',
  // Finishing
  'events.alreadyFinished': 'El evento ya ha finalizado.',
  'events.finished': '🏁 <b>El evento {title} ha finalizado.</b> ¡Gracias por jugar!\n\nLa carta a Santa ahora es de solo lectura. El chat sigue abierto 7 días más (hasta el {until}) y después quedará en solo lectura. La historia del evento se guarda en la app.',
  'events.finishedButton': '📚 Abrir',
  // Deletion and full reset
  'events.deleted': '🗑 El propietario eliminó el evento {title} junto con las cartas y los chats.',
  'events.alreadyDeleted': 'El evento ya se eliminó.',
  'events.reset': '🎄 El propietario empezó de nuevo el evento {title}. Los datos anteriores se eliminaron. Para participar, pide un nuevo enlace de invitación.',
  'events.resetRace': 'El evento ya se reinició o cambió al mismo tiempo que el reinicio: actualiza la pantalla.',
  // Inviting participants of another event
  'events.registrationClosed': 'La inscripción está cerrada: ábrela para poder invitar.',
  'events.setupFirst': 'Primero abre la página de configuración /setup (ver README).',
  'events.invite': '📨 <b>Invitación al evento {title}</b> de Amigo Secreto.\nPulsa el botón para participar.',
  'events.inviteButton': '🎄 Participar',
  'events.inviteAgain': 'Las invitaciones ya se enviaron: puedes repetirlo dentro de un minuto.',
  // Reveal: {name} the Santa name
  'events.alreadyRevealed': 'El secreto ya se reveló.',
  'events.revealed': '🎅 <b>¡Secreto revelado!</b>\n\nEn el evento {title}, tu Santa secreto es <b>{name}</b>. ¡Felices fiestas! 🎄',
  // Reminders: empty letter (with and without deadline) and to Santas (with and without exchange date)
  'events.remindAgain': 'El recordatorio ya se envió: puedes repetirlo dentro de un minuto.',
  'events.remindUnfilled': '⏰ Recordatorio: tu carta a Santa en el evento {title} sigue vacía. Escríbela para que a tu Santa le sea más fácil elegir el regalo.',
  'events.remindUnfilledBy': '⏰ Recordatorio: tu carta a Santa en el evento {title} sigue vacía. Escríbela antes del <b>{date}</b> para que a tu Santa le sea más fácil elegir el regalo.',
  'events.remindSantas': '🎁 Recordatorio para Santa ({title}): ¿ya tienes listo el regalo para tu destinatario?\nCuando lo tengas, márcalo en la pestaña «Destinatario».',
  'events.remindSantasDated': '🎁 Recordatorio para Santa ({title}): ¿ya tienes listo el regalo para tu destinatario? Intercambio: <b>{date}</b>.\nCuando lo tengas, márcalo en la pestaña «Destinatario».',
  // Announcements
  'events.announceFinished': 'El evento ha finalizado: ya no se pueden enviar anuncios.',
  'events.announceEmpty': 'Escribe el texto del anuncio.',
  'events.announcement': '📣 <b>Anuncio · {title}</b>\n\n{text}',
  'events.announcementButton': '📌 Abrir el evento',
  'events.announceAgain': 'Este anuncio ya se envió.',
  // Settings
  'events.ringAfterDraw': 'Después del sorteo no se puede cambiar el sorteo circular.',
  // Activity log details
  'events.auditText.fromTemplate': 'a partir de «{title}»',
  'events.auditText.deleted': '«{title}», participantes: {n}',
  'events.auditText.reset': 'participantes eliminados: {n}',
  'events.auditText.invited': 'de «{title}», invitados: {n}',
  'events.auditText.pairs': 'asignaciones: {n}',
  'events.auditText.received': 'recibidos: {n}',
  'events.auditText.settings': 'ajustes',
  'events.auditText.ring': 'sorteo circular: {state}',
  'events.auditText.avoidPrevious': 'no repetir asignaciones anteriores: {state}',
  'events.auditText.on': 'activado',
  'events.auditText.off': 'desactivado',
  'events.auditText.registrationOpen': 'abierta',
  'events.auditText.registrationClosed': 'cerrada',
};
