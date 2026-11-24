// Spanish: texts of src/support.js (participant requests to organizers). {name}, {author}, {to} are names (HTML),
// {title} is the event title in quotes, {text} the message text.
export default {
  // Refusals
  'support.noRecipients': 'Ahora mismo no hay nadie que pueda responder la consulta.',
  'support.closed': 'La consulta ya está cerrada.',
  'support.notFound': 'Consulta no encontrada.',
  'support.ownThread': 'Es tu propia consulta: tiene que atenderla otra persona.',
  'support.sendFailed': 'No se pudo enviar: inténtalo de nuevo.',
  'support.noOpen': 'No hay ninguna consulta abierta.',
  'support.hidden': 'La consulta la atiende {name}: el chat solo lo ven esa persona y el propietario.',
  'support.alreadyTaken': '{name} ya atiende esta consulta.',
  'support.takeOwn': 'No puedes atender tu propia consulta.',
  'support.ledBy': 'La consulta la atiende {name}.',
  'support.passRights': 'Solo quien atiende la consulta o el propietario puede transferirla.',
  'support.passTarget': 'Solo se puede transferir al propietario o a otro administrador.',
  'support.alreadyLed': '{name} ya atiende esta consulta.',
  'support.passRace': 'La consulta cambió al mismo tiempo que esta acción: actualiza la pantalla e inténtalo de nuevo.',
  'support.closeRights': 'Solo quien atiende la consulta o el propietario puede cerrarla.',
  // Person in charge without a name (event screen counters)
  'support.assigneeFallback': 'responsable',
  // Buttons under notifications
  'support.openButton': '💬 Abrir',
  'support.takeButton': '🙋 Atender',
  // Who replied or closed, to the participant ({role})
  'support.role.owner': 'propietario',
  'support.role.admin': 'administrador',
  // Notifications to organizers
  'support.notice.opened': '🆘 <b>{name}</b> pide ayuda en el evento {title}:\n\n{text}',
  'support.notice.added': '💬 <b>{name}</b> añade a su consulta ({title}):\n\n{text}',
  'support.notice.writes': '💬 <b>{name}</b> escribe en la consulta ({title}):\n\n{text}',
  'support.notice.closedByUser': '✅ <b>{name}</b> cerró su consulta ({title}).',
  'support.notice.taken': '🙋 <b>{name}</b> atiende la consulta de <b>{author}</b> ({title}).',
  'support.notice.passedToYou': '↪️ <b>{name}</b> te transfirió la consulta de <b>{author}</b> ({title}).',
  'support.notice.passed': '↪️ <b>{name}</b> transfirió la consulta de <b>{author}</b> ({title}): ahora la atiende <b>{to}</b>.',
  'support.notice.closed': '✅ <b>{name}</b> cerró la consulta de <b>{author}</b> ({title}).',
  'support.notice.returned': '🔄 La consulta de <b>{author}</b> ({title}) vuelve a estar sin asignar.',
  // Notifications to the participant
  'support.user.taken': '🙋 <b>{name}</b> atiende tu consulta del evento {title}: la respuesta llegará aquí.',
  'support.user.reply': '💬 <b>{name}</b> ({role}) responde ({title}):\n\n{text}',
  'support.user.passed': '↪️ Ahora tu consulta del evento {title} la atiende <b>{name}</b>.',
  'support.user.closed': '✅ <b>{name}</b> ({role}) cerró tu consulta del evento {title}. Si sigues teniendo dudas, simplemente escribe de nuevo.',
  'support.user.returned': '🔄 Tu consulta del evento {title} vuelve a estar esperando respuesta.',
};
