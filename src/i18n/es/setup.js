// Spanish: texts of src/setup.js (the /setup page, bot commands, menu button and descriptions).
export default {
  'setup.title': 'Configuración',
  // Key form
  'setup.form.label': 'Clave de configuración (valor del secreto ADMIN_SECRET)',
  'setup.form.clear': 'Borrar el campo «Clave de configuración»',
  'setup.form.submit': 'Configurar el bot',
  'setup.noSecret.title': 'Falta ADMIN_SECRET',
  'setup.noSecret.text': 'Define el secreto ADMIN_SECRET de al menos 8 caracteres (ver las instrucciones).',
  'setup.start.title': '🎄 Configuración del bot',
  'setup.start.text': 'Escribe la clave de configuración, la que definiste con el comando\n<code>npx wrangler secret put ADMIN_SECRET</code>.',
  'setup.badKey.title': 'Clave incorrecta',
  'setup.badKey.text': 'La clave no es válida. Comprueba el valor de ADMIN_SECRET.',
  // The owner link has already been used
  'setup.locked.title': '🔒 Página bloqueada',
  'setup.locked.used': 'El enlace de propietario ya se usó, así que la página de configuración ya no lo muestra ni cambia los ajustes del bot.',
  'setup.locked.unlock': 'Para desbloquearla (por ejemplo, si el enlace se filtró o necesitas recuperar la propiedad), cambia la clave:',
  'setup.locked.then': 'Después vuelve a abrir esta página y escribe la nueva clave: aparecerá un nuevo enlace de propietario y el anterior dejará de funcionar.',
  // Setup steps
  'setup.step.token': 'Token del bot',
  'setup.step.webhook': 'Webhook',
  'setup.step.commands': 'Comandos',
  'setup.step.menuButton': 'Botón de la app',
  'setup.profileLater': 'el bot enviará los demás idiomas a Telegram en los próximos minutos',
  'setup.failed': 'No funcionó',
  // Bot commands, menu button and descriptions in Telegram
  'setup.command.start': 'Menú principal y mis eventos',
  'setup.command.language': 'Idioma del bot',
  'setup.command.cancel': 'Cancelar la entrada',
  'setup.menuButton': '🎁 Santa',
  'setup.description': '🎄 Bot privado para jugar al Amigo Secreto: cartas a Santa, sorteo con exclusiones, preguntas anónimas. Se entra con el enlace de invitación a un evento.',
  'setup.shortDescription': '🎄 Amigo Secreto para amigos, familia y compañeros de trabajo',
  // Result
  'setup.done.ok': '✅ Bot configurado',
  'setup.done.problems': '⚠️ Hay problemas',
  'setup.done.linkTitle': '1. Enlace de propietario',
  'setup.done.linkText': 'Ábrelo en Telegram: el bot te hará <b>propietario del bot</b>. El propietario crea eventos, nombra y quita\nadministradores en la app (pantalla principal → «Propietario y administradores») y puede abrir la vista de supervisión de las asignaciones.',
  'setup.done.linkWarn': '⚠️ El enlace <b>funciona una sola vez</b>: después de usarlo, esta página se bloquea hasta que cambies\nADMIN_SECRET. No se lo reenvíes a nadie: quien lo abra primero será el propietario. Si eso pasa, cambia ADMIN_SECRET,\nvuelve a abrir la página y usa el nuevo enlace. Mientras nadie haya usado el enlace, puedes volver a abrir esta página.',
  'setup.done.eventTitle': '2. Crea un evento',
  'setup.done.eventText': 'En el chat con el bot pulsa «🎁 Santa» → «🎄 Crear». Cada evento tiene su propio enlace de invitación: puedes\ncopiarlo o enviarlo a un chat directamente desde la app (pestaña «Gestión» del evento).',
};
