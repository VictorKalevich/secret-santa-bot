// Spanish: texts of src/constraints.js (exclusions and fixed assignments).
export default {
  'constraints.twoPeople': 'Elige dos personas distintas',
  // Exclusions
  'constraints.exclusionsFrozen': 'Después del sorteo, las exclusiones no cambian: si no, por los cambios de participantes se podrían deducir las asignaciones. Para cambiar las exclusiones, cancela el sorteo (mientras nadie haya visto a su destinatario).',
  'constraints.exclusionMembers': 'Solo se pueden poner exclusiones entre participantes del evento.',
  // Fixed assignments; {santa} and {ward} are the fixed pair, {name} a participant
  'constraints.fixedFrozen': 'Después del sorteo, las asignaciones fijas no cambian. Para cambiarlas, cancela el sorteo.',
  'constraints.fixedMembers': 'Solo se pueden fijar asignaciones entre participantes del evento.',
  'constraints.ringOneWay': 'Con el sorteo circular, una asignación solo se puede fijar en un sentido.',
  'constraints.ringReverse': 'Con el sorteo circular, una asignación solo se puede fijar en un sentido: «{santa}» ya regala a «{ward}».',
  'constraints.santaTaken': '«{name}» ya tiene un destinatario fijo: quita primero esa asignación.',
  'constraints.wardTaken': '«{name}» ya tiene un Santa fijo: quita primero esa asignación.',
  'constraints.fixedChanged': 'Las asignaciones fijas acaban de cambiar: actualiza la pantalla e inténtalo de nuevo.',
};
