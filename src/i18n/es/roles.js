// Spanish: texts of src/roles.js (bot owner, admins, moving participation). {name}, {from}, {to}, {actor} are names (HTML).
export default {
  // App button under a message about new rights
  'roles.openButton': '🛠 Abrir',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ La propiedad del bot pasó a <b>{name}</b> con el enlace de la página de configuración. Sigues teniendo permisos de administrador.\n\nSi no fuiste tú y no estaba acordado, cambia ADMIN_SECRET (ver README), abre la página de configuración y usa el nuevo enlace de propietario.',
  'roles.botOwner.transferred': '👑 <b>Te han transferido la propiedad del bot.</b> Ahora nombras y quitas administradores en la sección «Propietario y administradores» de la pantalla principal de la app.',
  'roles.botOwner.notice': 'ℹ️ Nuevo propietario del bot: <b>{name}</b>.',
  // Transferring ownership (of the bot and of a room)
  'roles.transferTarget': 'Solo puedes transferir la propiedad a una persona registrada.',
  'roles.alreadyOwnerSelf': 'Ya eres el propietario.',
  'roles.alreadyTransferred': 'La propiedad ya se transfirió.',
  // Admins
  'roles.alreadyAdmin': 'Ya es administrador(a).',
  'roles.notAdmin': 'No es administrador(a).',
  'roles.grantUnregistered': 'Solo puedes nombrar a una persona registrada.',
  'roles.revokeOwner': 'No se pueden quitar los permisos del propietario. Primero transfiere la propiedad.',
  'roles.granted': '🛠 <b>El propietario te nombró administrador.</b>\n\nAhora puedes crear eventos y gestionarlos: invitaciones, exclusiones, sorteo, recordatorios. Solo el propietario puede ver las asignaciones, en la vista de supervisión.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> ahora es administrador(a).',
  'roles.revoked': 'El propietario te quitó los permisos de administrador. Como participante, sigues jugando como siempre.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> ya no es administrador(a).',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Elige dos cuentas distintas.',
  'roles.transfer.staffTarget': 'No se puede traspasar la participación a la cuenta del propietario o de un administrador.',
  'roles.transfer.noOld': 'No se encontró la cuenta anterior.',
  'roles.transfer.unregistered': 'La cuenta nueva debe terminar de registrarse (escribir su nombre al bot).',
  'roles.transfer.inDraw': 'La cuenta nueva ya está en el sorteo del evento «{title}»: elige otra cuenta.',
  'roles.transfer.toNew': '🔁 El propietario traspasó a esta cuenta tu participación en «Amigo Secreto»: se conservan las cartas, los destinatarios, los chats y el historial de eventos.',
  'roles.transfer.toOld': '🔁 Tu participación en «Amigo Secreto» se traspasó a la cuenta <b>{to}</b>. Si no pediste el traspaso, contacta con el propietario.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> traspasó la participación de <b>{from}</b> a la cuenta <b>{to}</b>.',
  // Activity log: new owner; move "old account -> new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
