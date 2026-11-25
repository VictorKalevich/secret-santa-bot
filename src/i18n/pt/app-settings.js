// Texts of app part 04-settings (063): the "Settings" screen — profile, language, notifications, "About the bot" and
// the "Bot owner" section (all events, who can create, bot log, transferring rights)
export default {
  'app.settings.title': 'Ajustes',
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': 'Perfil',
  'app.settings.profile.editName': '✏️ Mudar nome',
  'app.settings.name.title': 'Seu nome',
  'app.settings.name.hint': 'O nome é o mesmo em todos os eventos. Ele é visto pelo dono, pelos administradores e pelo seu Papai Noel — e, na revelação, pelo seu presenteado.',
  'app.settings.name.empty': 'Escreva um nome',
  'app.settings.name.saved': 'Nome salvo',
  // 061: bot and app language; name — language name in that language
  'app.settings.lang.button': '🌐 Idioma',
  'app.settings.lang.auto': 'Como no Telegram ({name})',
  'app.settings.lang.hint': 'O bot e o app vão ficar neste idioma. “Como no Telegram” é o idioma do seu Telegram.',
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': 'Notificações',
  'app.settings.notify.sound': '🔔 Som',
  'app.settings.notify.silent': '🔕 Mudo',
  'app.settings.notify.off': '🚫 Desligado',
  'app.settings.notify.hint': 'Vale para as mensagens “o presenteado alterou a carta” e “presente enviado”.',
  // "About the bot": how it works (items — app.event.how.*)
  'app.settings.about': 'Sobre o bot',
  // Bot owner section
  'app.settings.bot.title': 'Dono do bot',
  'app.settings.bot.events': '🗂 Todos os eventos',
  'app.settings.bot.creators': '✍️ Quem pode criar eventos',
  'app.settings.bot.log': '📜 Registro do bot',
  'app.settings.bot.pass': '👑 Transferir direitos de dono do bot',
  // "All events": newest first, 50 at a time; {owner} — the event owner's name, {n} — participants
  'app.settings.events.title': 'Todos os eventos',
  'app.settings.events.about': 'Dono — {owner} · participantes: {n}',
  'app.settings.events.more': 'Mostrar mais',
  'app.settings.events.empty': 'Ainda não há eventos.',
  // "Who can create events" (closed bot)
  'app.settings.creators.title': 'Quem pode criar eventos',
  'app.settings.creators.hint': 'Podem criar eventos você e as pessoas a quem você permitir. Quem cria um evento se torna o dono dele.',
  'app.settings.creators.empty': 'Ainda não há outras pessoas no bot.',
  'app.settings.creators.on': '“{name}” agora pode criar eventos',
  'app.settings.creators.off': '“{name}” não pode mais criar eventos',
  // Transfer bot owner rights
  'app.settings.pass.title': 'Direitos de dono do bot',
  'app.settings.pass.hint': 'O bot tem um único dono: ele vê todos os eventos e transfere a participação para novas contas. Seus eventos continuam com você.',
  'app.settings.pass.choose': 'Para quem transferir…',
  'app.settings.pass.empty': 'Ainda não há para quem transferir.',
  'app.settings.pass.confirm': 'Transferir os direitos de dono do bot para “{name}”? Seus eventos continuam com você, mas você não verá mais os eventos dos outros nem o registro do bot.',
  'app.settings.pass.done': '👑 Direitos de dono do bot transferidos',
};
