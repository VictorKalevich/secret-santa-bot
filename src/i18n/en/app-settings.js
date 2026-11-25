// Texts of the app part 04-settings (063, English): the "Settings" screen — profile, language, notifications, "About
// the bot" and the "Bot owner" section (all events, who can create, bot log, transferring ownership)
export default {
  'app.settings.title': 'Settings',
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': 'Profile',
  'app.settings.profile.editName': '✏️ Change name',
  'app.settings.name.title': 'Your name',
  'app.settings.name.hint': 'One name for all events. The owner, admins and your Santa see it — and so does your giftee after the reveal.',
  'app.settings.name.empty': 'Enter your name',
  'app.settings.name.saved': 'Name saved',
  // 061: language of the bot and the app; name — the language name in that language
  'app.settings.lang.button': '🌐 Language',
  'app.settings.lang.auto': 'Same as Telegram ({name})',
  'app.settings.lang.hint': 'The bot and the app will use this language. “Same as Telegram” is the language of your Telegram.',
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': 'Notifications',
  'app.settings.notify.sound': '🔔 Sound',
  'app.settings.notify.silent': '🔕 Silent',
  'app.settings.notify.off': '🚫 Off',
  // Bot owner section
  'app.settings.bot.title': 'Bot owner',
  'app.settings.bot.events': '🗂 All events',
  'app.settings.bot.creators': '✍️ Who can create events',
  'app.settings.bot.log': '📜 Bot log',
  'app.settings.bot.pass': '👑 Transfer bot ownership',
  // "All events": newest first, 50 at a time; {owner} — the event owner's name, {n} — participants
  'app.settings.events.title': 'All events',
  'app.settings.events.about': 'Owner — {owner} · participants: {n}',
  'app.settings.events.more': 'Show more',
  'app.settings.events.empty': 'No events yet.',
  // "Who can create events" (closed bot)
  'app.settings.creators.title': 'Who can create events',
  'app.settings.creators.hint': 'You and the people you allow can create events. Whoever creates an event becomes its owner.',
  'app.settings.creators.empty': 'There’s no one else in the bot yet.',
  'app.settings.creators.on': '“{name}” can now create events',
  'app.settings.creators.off': '“{name}” can no longer create events',
  // Transfer bot ownership
  'app.settings.pass.title': 'Bot ownership',
  'app.settings.pass.hint': 'There is only one bot owner: they see all events and move participation to new accounts. Your events stay yours.',
  'app.settings.pass.choose': 'Transfer to…',
  'app.settings.pass.empty': 'There’s no one to transfer it to yet.',
  'app.settings.pass.confirm': 'Transfer bot ownership to “{name}”? Your events stay yours, but you’ll no longer see other people’s events or the bot log.',
  'app.settings.pass.done': '👑 Bot ownership transferred',
};
