// Texts of app part 04-settings (063): the "Settings" screen - profile, language, notifications, "About the bot" and the
// "Bot owner" section (all events, who can create events, bot log, passing the rights)
export default {
  'app.settings.title': "Impostazioni",
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': "Profilo",
  'app.settings.profile.editName': "✏️ Cambia nome",
  'app.settings.name.title': "Il tuo nome",
  'app.settings.name.hint': "Il nome è lo stesso in tutti gli eventi. Lo vedono il proprietario, gli amministratori e il tuo Babbo Natale, e alla rivelazione anche il tuo destinatario.",
  'app.settings.name.empty': "Scrivi un nome",
  'app.settings.name.saved': "Nome salvato",
  // 061: language of the bot and the app; name - the language name in that language
  'app.settings.lang.button': "🌐 Lingua",
  'app.settings.lang.auto': "Come su Telegram ({name})",
  'app.settings.lang.hint': "Il bot e l'app saranno in questa lingua. «Come su Telegram» è la lingua del tuo Telegram.",
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': "Notifiche",
  'app.settings.notify.sound': "🔔 Suono",
  'app.settings.notify.silent': "🔕 Muto",
  'app.settings.notify.off': "🚫 Off",
  'app.settings.notify.hint': "Vale per i messaggi «il destinatario ha modificato la letterina» e «regalo spedito».",
  // "About the bot": how it works (items - app.event.how.*)
  'app.settings.about': "Informazioni sul bot",
  // Bot owner section
  'app.settings.bot.title': "Proprietario del bot",
  'app.settings.bot.events': "🗂 Tutti gli eventi",
  'app.settings.bot.creators': "✍️ Chi può creare eventi",
  'app.settings.bot.log': "📜 Registro del bot",
  'app.settings.bot.pass': "👑 Cedi il ruolo di proprietario del bot",
  // "All events": newest first, 50 at a time; {owner} - the event owner's name, {n} - participants
  'app.settings.events.title': "Tutti gli eventi",
  'app.settings.events.about': "Proprietario: {owner} · partecipanti: {n}",
  'app.settings.events.more': "Mostra altri",
  'app.settings.events.empty': "Non ci sono ancora eventi.",
  // "Who can create events" (closed bot)
  'app.settings.creators.title': "Chi può creare eventi",
  'app.settings.creators.hint': "Gli eventi possono crearli tu e le persone a cui lo permetti. Chi crea un evento ne diventa il proprietario.",
  'app.settings.creators.empty': "Nel bot non ci sono ancora altre persone.",
  'app.settings.creators.on': "«{name}» ora può creare eventi",
  'app.settings.creators.off': "«{name}» non può più creare eventi",
  // Passing the bot owner rights
  'app.settings.pass.title': "Ruolo di proprietario del bot",
  'app.settings.pass.hint': "Il proprietario del bot è uno solo: vede tutti gli eventi e trasferisce la partecipazione su un nuovo account. I tuoi eventi restano tuoi.",
  'app.settings.pass.choose': "A chi cederlo…",
  'app.settings.pass.empty': "Per ora non c'è nessuno a cui cedere il ruolo.",
  'app.settings.pass.confirm': "Cedere il ruolo di proprietario del bot a «{name}»? I tuoi eventi restano tuoi, ma non vedrai più gli eventi degli altri né il registro del bot.",
  'app.settings.pass.done': "👑 Ruolo di proprietario del bot ceduto",
};
