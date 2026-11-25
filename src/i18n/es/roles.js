// Spanish: texts of src/roles.js (bot owner, event owner and admins, moving participation). {name}, {from}, {to},
// {actor}, {who} are names (HTML), {title} is the event title in quotes (HTML).
export default {
  // App button under the message about new rights
  'roles.openButton': '🛠 Abrir',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ La propiedad del bot pasó a <b>{name}</b> con el enlace de la página de configuración. Tus eventos siguen siendo tuyos.\n\nSi no fuiste tú y no estaba acordado, cambia ADMIN_SECRET (ver README), abre la página de configuración y usa el nuevo enlace de propietario.',
  'roles.botOwner.transferred': '👑 <b>Te han transferido la propiedad del bot.</b> El registro del bot, todos los eventos y la transferencia de la propiedad están en la app: ⚙️ «Configuración» → «Propietario del bot».',
  'roles.botOwner.notice': 'ℹ️ Nuevo propietario del bot: <b>{name}</b>.',
  // Transferring bot owner rights
  'roles.transferTarget': 'Solo puedes transferir la propiedad a una persona registrada.',
  'roles.alreadyOwnerSelf': 'Ya eres el propietario.',
  'roles.alreadyTransferred': 'La propiedad ya se transfirió.',
  // Event admins
  'roles.alreadyAdmin': 'Ya es administrador(a).',
  'roles.notAdmin': 'No es administrador(a).',
  'roles.grantMember': 'Solo puedes nombrar a un participante del evento.',
  'roles.revokeOwner': 'No se pueden quitar los permisos del propietario. Primero transfiere la propiedad del evento.',
  'roles.granted': '🛠 <b>Te nombraron administrador del evento {title}.</b>\n\nAhora puedes gestionarlo: invitaciones, exclusiones, sorteo, recordatorios. Solo el propietario del evento puede ver las asignaciones, en la vista de supervisión.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> ahora es administrador(a) del evento {title}.',
  'roles.revoked': 'Te quitaron los permisos de administrador del evento {title}. Si participas en él, sigues jugando como siempre.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> ya no es administrador(a) del evento {title}.',
  // Event ownership
  'roles.owner.already': 'Ya es propietario(a).',
  'roles.owner.target': 'Solo puedes transferir la propiedad a un participante o administrador del evento.',
  'roles.owner.alreadyPassed': 'La propiedad ya se transfirió.',
  'roles.owner.toNew': '👑 <b>Ahora eres el propietario del evento {title}.</b> Nombras administradores, abres la vista de supervisión, reinicias y eliminas el evento, todo desde la app.',
  'roles.owner.toPrev': 'ℹ️ La propiedad del evento {title} pasó a <b>{who}</b>. Sigues teniendo permisos de administrador.',
  'roles.owner.notice': 'ℹ️ Nuevo propietario del evento {title}: <b>{who}</b>.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Elige dos cuentas distintas.',
  'roles.transfer.staffTarget': 'No se puede traspasar la participación a la cuenta del propietario o de un administrador.',
  'roles.transfer.noOld': 'No se encontró la cuenta anterior.',
  'roles.transfer.unregistered': 'La cuenta nueva debe terminar de registrarse (escribir su nombre al bot).',
  'roles.transfer.inDraw': 'La cuenta nueva ya está en el sorteo del evento «{title}»: elige otra cuenta.',
  'roles.transfer.toNew': '🔁 El propietario del bot traspasó a esta cuenta tu participación en «Amigo Secreto»: se conservan las cartas, los destinatarios, los chats y el historial de eventos.',
  'roles.transfer.toOld': '🔁 Tu participación en «Amigo Secreto» se traspasó a la cuenta <b>{to}</b>. Si no pediste el traspaso, contacta con el propietario del bot.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> traspasó la participación de <b>{from}</b> a la cuenta <b>{to}</b>.',
  // Activity log: new owner; move "old account -> new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
