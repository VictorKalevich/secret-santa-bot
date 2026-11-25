// Spanish: app part 04-settings (the "Settings" screen: profile, language, notifications, "About the bot" and the
// "Bot owner" section).
export default {
  'app.settings.title': 'Configuración',
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': 'Perfil',
  'app.settings.profile.editName': '✏️ Cambiar nombre',
  'app.settings.name.title': 'Tu nombre',
  'app.settings.name.hint': 'Tu nombre es el mismo en todos los eventos. Lo ven el propietario, los administradores y tu Santa, y en la revelación, también tu destinatario.',
  'app.settings.name.empty': 'Escribe tu nombre',
  'app.settings.name.saved': 'Nombre guardado',
  // Bot and app language; {name} is the language name in that language
  'app.settings.lang.button': '🌐 Idioma',
  'app.settings.lang.auto': 'Como en Telegram ({name})',
  'app.settings.lang.hint': 'El bot y la app estarán en este idioma. «Como en Telegram»: el idioma de tu Telegram.',
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': 'Notificaciones',
  'app.settings.notify.sound': '🔔 Sonido',
  'app.settings.notify.silent': '🔕 Silencio',
  'app.settings.notify.off': '🚫 Apagado',
  'app.settings.notify.hint': 'Se aplica a los avisos «tu destinatario cambió su carta» y «regalo enviado».',
  // "About the bot": how it works (items — app.event.how.*)
  'app.settings.about': 'Sobre el bot',
  // Bot owner section
  'app.settings.bot.title': 'Propietario del bot',
  'app.settings.bot.events': '🗂 Todos los eventos',
  'app.settings.bot.creators': '✍️ Quién puede crear eventos',
  'app.settings.bot.log': '📜 Registro del bot',
  'app.settings.bot.pass': '👑 Transferir la propiedad del bot',
  // "All events": newest first, 50 at a time; {owner} — the event owner's name, {n} — participants
  'app.settings.events.title': 'Todos los eventos',
  'app.settings.events.about': 'Propietario: {owner} · participantes: {n}',
  'app.settings.events.more': 'Mostrar más',
  'app.settings.events.empty': 'Todavía no hay eventos.',
  // "Who can create events" (closed bot)
  'app.settings.creators.title': 'Quién puede crear eventos',
  'app.settings.creators.hint': 'Pueden crear eventos tú y las personas a las que se lo permitas. Quien crea un evento se convierte en su propietario.',
  'app.settings.creators.empty': 'Todavía no hay otras personas en el bot.',
  'app.settings.creators.on': '«{name}» ya puede crear eventos',
  'app.settings.creators.off': '«{name}» ya no puede crear eventos',
  // Transferring bot ownership
  'app.settings.pass.title': 'Propiedad del bot',
  'app.settings.pass.hint': 'El bot tiene un solo propietario: ve todos los eventos y traspasa la participación a cuentas nuevas. Tus eventos seguirán siendo tuyos.',
  'app.settings.pass.choose': 'A quién transferirla…',
  'app.settings.pass.empty': 'Todavía no hay a quién transferirla.',
  'app.settings.pass.confirm': '¿Transferir la propiedad del bot a «{name}»? Tus eventos seguirán siendo tuyos, pero ya no verás los eventos de otros ni el registro del bot.',
  'app.settings.pass.done': '👑 Propiedad del bot transferida',
};
