// Texts of app part 04-settings (063): the "Settings" screen - profile, language, notifications, "About the bot" and the
// "Bot owner" section (all events, who can create events, bot log, passing the rights)
export default {
  'app.settings.title': 'Ustawienia',
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': 'Profil',
  'app.settings.profile.editName': '✏️ Zmień imię',
  'app.settings.name.title': 'Twoje imię',
  'app.settings.name.hint': 'Imię jest jedno we wszystkich wydarzeniach. Widzą je właściciel, administratorzy i Twój Mikołaj, a po ujawnieniu — Twój podopieczny.',
  'app.settings.name.empty': 'Wpisz imię',
  'app.settings.name.saved': 'Imię zapisane',
  // 061: language of the bot and the app; name — the language name in that language
  'app.settings.lang.button': '🌐 Język',
  'app.settings.lang.auto': 'Jak w Telegramie ({name})',
  'app.settings.lang.hint': 'Bot i aplikacja będą w tym języku. „Jak w Telegramie” — język Twojego Telegrama.',
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': 'Powiadomienia',
  'app.settings.notify.sound': '🔔 Dźwięk',
  'app.settings.notify.silent': '🔕 Cicho',
  'app.settings.notify.off': '🚫 Wył.',
  'app.settings.notify.hint': 'Dotyczy wiadomości „podopieczny zmienił list” i „prezent wysłany”.',
  // "About the bot": how it works (items - app.event.how.*)
  'app.settings.about': 'O bocie',
  // Bot owner section
  'app.settings.bot.title': 'Właściciel bota',
  'app.settings.bot.events': '🗂 Wszystkie wydarzenia',
  'app.settings.bot.creators': '✍️ Kto może tworzyć wydarzenia',
  'app.settings.bot.log': '📜 Dziennik bota',
  'app.settings.bot.pass': '👑 Przekaż prawa właściciela bota',
  // "All events": newest first, 50 at a time; {owner} - the event owner's name, {n} - participants
  'app.settings.events.title': 'Wszystkie wydarzenia',
  'app.settings.events.about': 'Właściciel: {owner} · uczestników: {n}',
  'app.settings.events.more': 'Pokaż więcej',
  'app.settings.events.empty': 'Nie ma jeszcze wydarzeń.',
  // "Who can create events" (closed bot)
  'app.settings.creators.title': 'Kto może tworzyć wydarzenia',
  'app.settings.creators.hint': 'Wydarzenia możesz tworzyć Ty i osoby, którym na to pozwolisz. Kto utworzy wydarzenie, zostaje jego właścicielem.',
  'app.settings.creators.empty': 'W bocie nie ma jeszcze innych osób.',
  'app.settings.creators.on': '„{name}” może teraz tworzyć wydarzenia',
  'app.settings.creators.off': '„{name}” nie może już tworzyć wydarzeń',
  // Passing bot owner rights
  'app.settings.pass.title': 'Prawa właściciela bota',
  'app.settings.pass.hint': 'Właściciel bota jest jeden: widzi wszystkie wydarzenia i przenosi udział na nowe konto. Twoje wydarzenia zostaną przy Tobie.',
  'app.settings.pass.choose': 'Komu przekazać…',
  'app.settings.pass.empty': 'Na razie nie ma komu przekazać praw.',
  'app.settings.pass.confirm': 'Przekazać prawa właściciela bota osobie „{name}”? Twoje wydarzenia zostaną przy Tobie, ale cudzych wydarzeń i dziennika bota już nie zobaczysz.',
  'app.settings.pass.done': '👑 Prawa właściciela bota przekazane',
};
