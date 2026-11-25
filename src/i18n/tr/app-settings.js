// Texts of app part 04-settings (063): the "Settings" screen - profile, language, notifications, "About the bot" and the
// "Bot owner" section (all events, who can create events, bot log, passing the rights)
export default {
  'app.settings.title': "Ayarlar",
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': "Profil",
  'app.settings.profile.editName': "✏️ İsmi değiştir",
  'app.settings.name.title': "İsmin",
  'app.settings.name.hint': "İsmin tüm etkinliklerde aynıdır. Onu sahip, yöneticiler ve Noel Baba'n görür; sır açıklandığında alıcın da görür.",
  'app.settings.name.empty': "İsmini yaz",
  'app.settings.name.saved': "İsim kaydedildi",
  // 061: bot and app language; name is the language name in that language
  'app.settings.lang.button': "🌐 Dil",
  'app.settings.lang.auto': "Telegram'daki gibi ({name})",
  'app.settings.lang.hint': "Bot ve uygulama bu dilde olacak. «Telegram'daki gibi» — Telegram'ının dili.",
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': "Bildirimler",
  'app.settings.notify.sound': "🔔 Sesli",
  'app.settings.notify.silent': "🔕 Sessiz",
  'app.settings.notify.off': "🚫 Kapalı",
  'app.settings.notify.hint': "«Alıcın mektubunu değiştirdi» ve «Hediye gönderildi» mesajları için geçerlidir.",
  // "About the bot": how it works (items - app.event.how.*)
  'app.settings.about': "Bot hakkında",
  // Bot owner section
  'app.settings.bot.title': "Bot sahibi",
  'app.settings.bot.events': "🗂 Tüm etkinlikler",
  'app.settings.bot.creators': "✍️ Kimler etkinlik oluşturabilir",
  'app.settings.bot.log': "📜 Bot günlüğü",
  'app.settings.bot.pass': "👑 Bot sahipliğini devret",
  // "All events": newest first, 50 at a time; {owner} - the event owner's name, {n} - participants
  'app.settings.events.title': "Tüm etkinlikler",
  'app.settings.events.about': "Sahip: {owner} · katılımcı: {n}",
  'app.settings.events.more': "Daha fazla göster",
  'app.settings.events.empty': "Henüz etkinlik yok.",
  // "Who can create events" (closed bot)
  'app.settings.creators.title': "Kimler etkinlik oluşturabilir",
  'app.settings.creators.hint': "Etkinlikleri sen ve izin verdiğin kişiler oluşturabilir. Etkinliği oluşturan kişi onun sahibi olur.",
  'app.settings.creators.empty': "Botta henüz başka kimse yok.",
  'app.settings.creators.on': "«{name}» artık etkinlik oluşturabilir",
  'app.settings.creators.off': "«{name}» artık etkinlik oluşturamaz",
  // Passing the bot owner rights
  'app.settings.pass.title': "Bot sahipliği",
  'app.settings.pass.hint': "Botun tek bir sahibi olur: tüm etkinlikleri görür ve katılımı yeni hesaba taşır. Etkinliklerin sende kalır.",
  'app.settings.pass.choose': "Kime devredelim…",
  'app.settings.pass.empty': "Şimdilik devredilecek kimse yok.",
  'app.settings.pass.confirm': "«{name}» yeni bot sahibi olsun mu? Etkinliklerin sende kalır, ama başkalarının etkinliklerini ve bot günlüğünü artık göremezsin.",
  'app.settings.pass.done': "👑 Bot sahipliği devredildi",
};
