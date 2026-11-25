// Texts of app part 04-settings (063): the "Settings" screen - profile, language, notifications, "About the bot" and the
// "Bot owner" section (all events, who can create events, bot log, passing the rights)
export default {
  'app.settings.title': '设置',
  // "Profile" and the "Your name" sheet (035)
  'app.settings.profile.title': '个人资料',
  'app.settings.profile.editName': '✏️ 修改名字',
  'app.settings.name.title': '你的名字',
  'app.settings.name.hint': '所有活动都用同一个名字。所有者、管理员和你的圣诞老人能看到它，揭晓时你的收礼人也会看到。',
  'app.settings.name.empty': '请填写名字',
  'app.settings.name.saved': '名字已保存',
  // 061: bot and app language; name is the language name in that language
  'app.settings.lang.button': '🌐 语言',
  'app.settings.lang.auto': '跟随 Telegram（{name}）',
  'app.settings.lang.hint': '机器人和应用将使用这种语言。“跟随 Telegram”即使用你的 Telegram 语言。',
  // Notifications: the mode and which messages it applies to
  'app.settings.notify.title': '通知',
  'app.settings.notify.sound': '🔔 有声音',
  'app.settings.notify.silent': '🔕 静音',
  'app.settings.notify.off': '🚫 关闭',
  'app.settings.notify.hint': '适用于“收礼人修改了心愿信”和“礼物已寄出”这两类消息。',
  // "About the bot": how it works (items - app.event.how.*)
  'app.settings.about': '关于机器人',
  // Bot owner section
  'app.settings.bot.title': '机器人所有者',
  'app.settings.bot.events': '🗂 所有活动',
  'app.settings.bot.creators': '✍️ 谁可以创建活动',
  'app.settings.bot.log': '📜 机器人日志',
  'app.settings.bot.pass': '👑 转让机器人所有者身份',
  // "All events": newest first, 50 at a time; {owner} - the event owner's name, {n} - participants
  'app.settings.events.title': '所有活动',
  'app.settings.events.about': '所有者：{owner} · 参与者：{n}',
  'app.settings.events.more': '显示更多',
  'app.settings.events.empty': '还没有活动。',
  // "Who can create events" (closed bot)
  'app.settings.creators.title': '谁可以创建活动',
  'app.settings.creators.hint': '你和你允许的人可以创建活动。谁创建了活动，谁就是它的所有者。',
  'app.settings.creators.empty': '机器人里还没有其他人。',
  'app.settings.creators.on': '“{name}”现在可以创建活动了',
  'app.settings.creators.off': '“{name}”不能再创建活动了',
  // Pass bot owner rights
  'app.settings.pass.title': '机器人所有者权限',
  'app.settings.pass.hint': '机器人所有者只有一位：可以看到所有活动，并能把参与记录转移到新账号。你的活动仍归你所有。',
  'app.settings.pass.choose': '转让给谁…',
  'app.settings.pass.empty': '目前还没有可以转让的人。',
  'app.settings.pass.confirm': '把机器人所有者身份转让给“{name}”？你的活动仍归你所有，但你将看不到别人的活动和机器人日志。',
  'app.settings.pass.done': '👑 机器人所有者身份已转让',
};
