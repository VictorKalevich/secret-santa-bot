// Texts of app part 04-settings (063, German): the "Settings" screen - profile, language, notifications, "About the
// bot" and the "Bot owner" section (all rounds, who can create, bot log, transferring rights)
export default {
  'app.settings.title': 'Einstellungen',
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': 'Profil',
  'app.settings.profile.editName': '✏️ Name ändern',
  'app.settings.name.title': 'Dein Name',
  'app.settings.name.hint': 'Dein Name gilt in allen Runden. Ihn sehen der Inhaber, die Admins und dein Wichtel, nach der Auflösung auch dein Wichtelkind.',
  'app.settings.name.empty': 'Gib deinen Namen ein',
  'app.settings.name.saved': 'Name gespeichert',
  // 061: language of the bot and the app; name - the language name in that language
  'app.settings.lang.button': '🌐 Sprache',
  'app.settings.lang.auto': 'Wie in Telegram ({name})',
  'app.settings.lang.hint': 'Bot und App erscheinen in dieser Sprache. «Wie in Telegram» – die Sprache deines Telegram.',
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': 'Benachrichtigungen',
  'app.settings.notify.sound': '🔔 Ton',
  'app.settings.notify.silent': '🔕 Leise',
  'app.settings.notify.off': '🚫 Aus',
  'app.settings.notify.hint': 'Gilt für die Nachrichten «Wichtelkind hat den Wunschzettel geändert» und «Geschenk verschickt».',
  // "About the bot": how it works (items - app.event.how.*)
  'app.settings.about': 'Über den Bot',
  // Bot owner section
  'app.settings.bot.title': 'Bot-Inhaber',
  'app.settings.bot.events': '🗂 Alle Runden',
  'app.settings.bot.creators': '✍️ Wer Runden erstellen darf',
  'app.settings.bot.log': '📜 Bot-Protokoll',
  'app.settings.bot.pass': '👑 Bot-Inhaberrechte übertragen',
  // "All events": newest first, 50 at a time; {owner} - the event owner's name, {n} - participants
  'app.settings.events.title': 'Alle Runden',
  'app.settings.events.about': 'Inhaber – {owner} · Teilnehmer: {n}',
  'app.settings.events.more': 'Mehr anzeigen',
  'app.settings.events.empty': 'Noch keine Runden.',
  // "Who can create events" (closed bot)
  'app.settings.creators.title': 'Wer Runden erstellen darf',
  'app.settings.creators.hint': 'Runden erstellen dürfen du und die Personen, denen du es erlaubst. Wer eine Runde erstellt, wird ihr Inhaber.',
  'app.settings.creators.empty': 'Im Bot gibt es noch keine anderen Personen.',
  'app.settings.creators.on': '«{name}» darf jetzt Runden erstellen',
  'app.settings.creators.off': '«{name}» darf keine Runden mehr erstellen',
  // Transfer the bot owner rights
  'app.settings.pass.title': 'Bot-Inhaberrechte',
  'app.settings.pass.hint': 'Es gibt nur einen Bot-Inhaber: Er sieht alle Runden und überträgt Teilnahmen auf neue Konten. Deine Runden bleiben bei dir.',
  'app.settings.pass.choose': 'An wen übertragen…',
  'app.settings.pass.empty': 'Noch niemand, an den du die Rechte übertragen kannst.',
  'app.settings.pass.confirm': 'Bot-Inhaberrechte an «{name}» übertragen? Deine Runden bleiben bei dir, aber fremde Runden und das Bot-Protokoll siehst du dann nicht mehr.',
  'app.settings.pass.done': '👑 Bot-Inhaberrechte übertragen',
};
