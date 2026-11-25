// Spanish: texts of src/membership.js (joining, join requests, "I take part", leaving).
export default {
  'membership.memberNotFound': 'Participante no encontrado.',
  // Activity log: family name and members (records before 062), "I take part"
  'membership.audit.familySave': '«{name}»: {people}',
  'membership.audit.familyDelete': '«{name}»',
  'membership.audit.isParticipant': 'participa',
  'membership.audit.notParticipant': 'no participa',
  'membership.afterDraw': 'Después del sorteo no se puede. Pide {owner.dat} que te añada.',
  // Participant leaving
  'membership.leaveAfterDraw': 'El sorteo ya se hizo. Para salir, habla con el propietario o con los administradores.',
  'membership.leaveFinished': 'El evento ha finalizado: ya no puedes salir de él.',
  'membership.leaveNotice': '🚪 <b>{name}</b> sale del evento {title}.',
  'membership.openEventButton': '🛠 Abrir el evento',
  // Letting removed people back
  'membership.notRemoved': 'Esta persona no está entre las eliminadas.',
  // Joining and join requests
  'membership.joinedNotice': '👋 <b>{name}</b> se une al evento {title}',
  'membership.request': '🙋 <b>{name}</b> quiere participar en el evento {title}.',
  'membership.requestWithUsername': '🙋 <b>{name}</b> (@{username}) quiere participar en el evento {title}.',
  'membership.acceptButton': '✅ Aceptar',
  'membership.rejectButton': '❌ Rechazar',
  'membership.requestNotFound': 'Solicitud no encontrada.',
  'membership.requestDecided': 'La solicitud ya se revisó.',
  'membership.approveFinished': 'El evento ha finalizado: ya no se puede aceptar a nadie.',
  'membership.approveClosed': 'La inscripción al evento «{title}» está cerrada: ábrela para aceptar la solicitud.',
  // Decision on a join request: to the person and to the other admins
  'membership.approvedAfterDraw': '🎉 ¡Solicitud aprobada: ya estás en el evento {title}! El sorteo ya se hizo: {owner.nom} te añadirá y el bot te avisará. Mientras tanto, escribe tu carta a Santa.',
  'membership.approved': '🎉 ¡Solicitud aprobada: ya estás en el evento {title}! Abre la app y escribe tu carta a tu Santa secreto.',
  'membership.requestRejected': 'Rechazaron tu solicitud para participar en el evento {title}. Si es un error, contacta con el propietario o con un administrador.',
  'membership.approvedBy': '✅ <b>{by}</b> aceptó la solicitud de <b>{name}</b> para el evento {title}.',
  'membership.rejectedBy': '❌ <b>{by}</b> rechazó la solicitud de <b>{name}</b> para el evento {title}.',
};
