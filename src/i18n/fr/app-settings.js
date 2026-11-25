// Texts of app part 04-settings (063): the "Settings" screen - profile, language, notifications, "About the bot" and
// the "Bot owner" section (all events, who can create, bot log, transferring rights)
export default {
  'app.settings.title': "Réglages",
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': "Profil",
  'app.settings.profile.editName': "✏️ Modifier le nom",
  'app.settings.name.title': "Ton nom",
  'app.settings.name.hint': "Ton nom est le même dans tous les événements. Le propriétaire, les administrateurs et ton Père Noël le voient, et à la révélation, ton destinataire aussi.",
  'app.settings.name.empty': "Écris ton nom",
  'app.settings.name.saved': "Nom enregistré",
  // 061: bot and app language; name - the language name in that language
  'app.settings.lang.button': "🌐 Langue",
  'app.settings.lang.auto': "Comme dans Telegram ({name})",
  'app.settings.lang.hint': "Le bot et l'appli seront dans cette langue. « Comme dans Telegram » : la langue de ton Telegram.",
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': "Notifications",
  'app.settings.notify.sound': "🔔 Son",
  'app.settings.notify.silent': "🔕 Muet",
  'app.settings.notify.off': "🚫 Désactivé",
  // Bot owner section
  'app.settings.bot.title': "Propriétaire du bot",
  'app.settings.bot.events': "🗂 Tous les événements",
  'app.settings.bot.creators': "✍️ Qui peut créer des événements",
  'app.settings.bot.log': "📜 Journal du bot",
  'app.settings.bot.pass': "👑 Transmettre les droits de propriétaire du bot",
  // "All events": newest first, 50 at a time; {owner} - the event owner's name, {n} - participants
  'app.settings.events.title': "Tous les événements",
  'app.settings.events.about': "Propriétaire : {owner} · participants : {n}",
  'app.settings.events.more': "Afficher plus",
  'app.settings.events.empty': "Pas encore d'événements.",
  // "Who can create events" (closed bot)
  'app.settings.creators.title': "Qui peut créer des événements",
  'app.settings.creators.hint': "Toi et les personnes que tu autorises pouvez créer des événements. Qui crée un événement en devient le propriétaire.",
  'app.settings.creators.empty': "Il n'y a encore personne d'autre dans le bot.",
  'app.settings.creators.on': "« {name} » peut désormais créer des événements",
  'app.settings.creators.off': "« {name} » ne peut plus créer d'événements",
  // Pass the bot owner rights
  'app.settings.pass.title': "Droits de propriétaire du bot",
  'app.settings.pass.hint': "Le bot n'a qu'un propriétaire : il voit tous les événements et transfère les participations vers de nouveaux comptes. Tes événements restent à toi.",
  'app.settings.pass.choose': "À qui les transmettre…",
  'app.settings.pass.empty': "Personne à qui les transmettre pour l'instant.",
  'app.settings.pass.confirm': "Transmettre les droits de propriétaire du bot à « {name} » ? Tes événements restent à toi, mais tu ne verras plus les événements des autres ni le journal du bot.",
  'app.settings.pass.done': "👑 Droits de propriétaire du bot transmis",
};
