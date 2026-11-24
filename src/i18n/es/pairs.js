// Spanish: texts of src/pairs.js (draw, adding after the draw, removal, cancellation, giftee swap).
export default {
  // Why the draw is impossible (pairs.reason.<problem type>); {name} is a participant
  'pairs.reason.too_few': 'Hacen falta al menos 2 participantes.',
  'pairs.reason.ring_too_few': 'Para el sorteo circular hacen falta al menos 3 participantes, o desactiva el sorteo circular en los ajustes.',
  'pairs.reason.ring_impossible': 'Parece que con estas exclusiones no se pueden evitar los regalos recíprocos. Inténtalo otra vez; si no funciona, quita algunas exclusiones o desactiva el sorteo circular.',
  'pairs.reason.no_receivers': '{name} no puede regalar a nadie: revisa las exclusiones.',
  'pairs.reason.no_givers': 'A {name} no le puede tocar a nadie: revisa las exclusiones.',
  'pairs.reason.search_exhausted': 'No se pudo encontrar una asignación rápidamente: inténtalo otra vez. Si no funciona, quita algunas exclusiones o desactiva el sorteo circular.',
  'pairs.reason.fixed_block': 'Lo impiden las asignaciones fijas: con ellas no se puede repartir a todos según las reglas. {owner.nomCap} puede quitar algunas asignaciones fijas.',
  'pairs.reason.too_strict': 'Demasiadas exclusiones: no se puede repartir a todos respetándolas. Quita algunas exclusiones.',
  'pairs.familiesBlock': 'Lo impiden las familias: los miembros de una familia no se regalan entre sí, y así no se puede repartir a todos. Desactiva «Tener en cuenta familias» o el sorteo circular.',
  // Draw
  'pairs.drawn': '🎄 <b>¡Sorteo del evento {title} hecho!</b>\n\nAbre la app y mira la pestaña «Destinatario» para saber a quién le regalas. No se lo cuentes a nadie 🤫',
  'pairs.drawnButton': '🎁 Ver mi destinatario',
  'pairs.drawFinished': 'El evento ha finalizado.',
  'pairs.drawRace': 'Los participantes, las exclusiones o las familias cambiaron durante el sorteo: inténtalo otra vez.',
  'pairs.notDrawn': 'El sorteo no está hecho.',
  // Assignments after a change of participants: to the new participant and to a Santa with a new giftee
  'pairs.inserted': '🎄 <b>¡Ya estás en el juego!</b> Ya se hizo tu sorteo en el evento {title}: mira la pestaña «Destinatario» 🤫',
  'pairs.newWard': '🔄 Los participantes del evento {title} cambiaron y ahora tienes un <b>nuevo destinatario</b>. Mira la pestaña «Destinatario».',
  'pairs.lookButton': '🎁 Ver',
  // Removing and adding a participant
  'pairs.notMember': 'Esta persona no participa en este evento.',
  'pairs.removeBlocked': 'No se puede quitar al participante sin romper las exclusiones o el sorteo circular. Reduce las exclusiones.',
  'pairs.removed': 'Te eliminaron del evento {title}. Si es un error, contacta con el propietario o con un administrador.',
  'pairs.alreadyInDraw': 'El participante ya está en el sorteo.',
  'pairs.insertBlocked': 'No se puede añadir al participante sin romper las reglas: todos los que podrían cambiar de destinatario ya tienen el regalo listo, o lo impiden las exclusiones. Puedes cancelar el sorteo en la zona de peligro y hacerlo de nuevo.',
  // Giftee swap: rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': 'Uno de los dos le regala al otro: tras el cambio, alguien se regalaría a sí mismo.',
  'pairs.swapRule.exclusion': 'Exclusiones: uno de los dos le regalaría a alguien a quien, por las exclusiones, no debe regalar.',
  'pairs.swapRule.family': 'Familias: uno de los dos le regalaría a un miembro de su familia.',
  'pairs.swapRule.ring': 'Sorteo circular: aparecería un regalo recíproco, dos personas se regalarían entre sí.',
  'pairs.swapRule.fixed': 'Asignaciones fijas: el cambio rompería una asignación que fijaste.',
  'pairs.swapRule.history': 'Asignaciones anteriores: uno de los dos le regalaría a la misma persona que en el evento anterior.',
  'pairs.swapRevealed': 'El secreto ya se reveló: no se pueden cambiar los destinatarios.',
  'pairs.swapTwo': 'Elige dos participantes distintos.',
  'pairs.notInDraw': 'El participante no está en el sorteo.',
  'pairs.swapStale': 'Las asignaciones ya cambiaron: vuelve a abrir el cambio.',
  'pairs.swapSelf': 'No se puede hacer el cambio entre estos dos: elige a otros dos participantes.',
  'pairs.swapRulesChanged': 'Las reglas del sorteo para este cambio cambiaron: vuelve a comprobarlo.',
  'pairs.swapNotice': '🔄 El propietario cambió el sorteo del evento {title}: ahora tienes un <b>nuevo destinatario</b>. La asignación anterior ya no vale y su chat se eliminó. Mira la pestaña «Destinatario».',
  // Draw cancellation and forced cancellation
  'pairs.cancelFinished': 'El evento ha finalizado: no se puede cancelar el sorteo.',
  'pairs.cancelRevealed': 'El secreto ya se reveló: no se puede cancelar el sorteo.',
  'pairs.cancelBlocked': 'No se puede cancelar: alguien ya vio a su destinatario o ya empezó un chat.',
  'pairs.cancelled': '↩️ <b>Se canceló el sorteo</b> del evento {title}. Tu carta a Santa sigue guardada. Cuando haya un nuevo sorteo, el bot te avisará.',
  'pairs.forceCancelled': '↩️ El propietario <b>canceló el sorteo</b> del evento {title}. La asignación anterior ya no vale y los chats con tu Santa y tu destinatario se eliminaron. Tu carta sigue guardada. Cuando haya un nuevo sorteo, el bot te avisará.',
  // Activity log details
  'pairs.auditText.members': 'participantes: {n}',
  'pairs.auditText.changed': 'asignaciones cambiadas: {n}',
  'pairs.auditText.removed': 'asignaciones eliminadas: {n}',
};
