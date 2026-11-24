// Texts of src/setup.js (060): setup page /setup, commands, menu button and bot descriptions.
// Paragraph markup (<code>, <b>) is part of the text
export default {
  'setup.title': '设置',
  // Key form
  'setup.form.label': '设置密钥（ADMIN_SECRET 的值）',
  'setup.form.clear': '清空“设置密钥”',
  'setup.form.submit': '设置机器人',
  'setup.noSecret.title': '需要 ADMIN_SECRET',
  'setup.noSecret.text': '请设置至少 8 个字符的密钥 ADMIN_SECRET（见说明）。',
  'setup.start.title': '🎄 设置机器人',
  'setup.start.text': '请输入设置密钥，也就是你用以下命令设置的值：\n<code>npx wrangler secret put ADMIN_SECRET</code>。',
  'setup.badKey.title': '密钥错误',
  'setup.badKey.text': '密钥不正确。请检查 ADMIN_SECRET 的值。',
  // The owner link has already been used
  'setup.locked.title': '🔒 页面已锁定',
  'setup.locked.used': '所有者链接已被使用，因此设置页面不再提供该链接，也不再修改机器人设置。',
  'setup.locked.unlock': '要解锁（例如链接泄露了，或需要收回所有者权限），请更换密钥：',
  'setup.locked.then': '然后重新打开此页面并输入新密钥，会生成新的所有者链接，旧链接将失效。',
  // Setup steps
  'setup.step.token': '机器人令牌',
  'setup.step.webhook': 'Webhook',
  'setup.step.commands': '命令',
  'setup.step.menuButton': '应用按钮',
  // 061: commands and descriptions in the other languages are sent in parts along with people's requests
  'setup.profileLater': '其余语言会在几分钟内由机器人提交给 Telegram',
  'setup.failed': '失败',
  // Commands, menu button and bot descriptions in Telegram
  'setup.command.start': '主菜单和我的活动',
  'setup.command.language': '机器人语言',
  'setup.command.cancel': '取消输入',
  'setup.menuButton': '🎁 圣诞老人',
  'setup.description': '🎄 不公开的神秘圣诞老人游戏机器人：给圣诞老人写心愿信、带排除规则的抽签、匿名提问。通过活动邀请链接加入。',
  'setup.shortDescription': '🎄 和朋友、家人、同事一起玩神秘圣诞老人',
  // Result
  'setup.done.ok': '✅ 机器人已设置好',
  'setup.done.problems': '⚠️ 存在问题',
  'setup.done.linkTitle': '1. 所有者链接',
  'setup.done.linkText': '在 Telegram 中打开它，机器人会让你成为<b>机器人所有者</b>。所有者可以创建活动，在应用中任命和撤销\n管理员（主页 → “所有者和管理员”），还可以打开后台查看配对。',
  'setup.done.linkWarn': '⚠️ 链接<b>只能使用一次</b>：打开后此页面会被锁定，直到你更换\nADMIN_SECRET。不要转发给任何人：谁先打开，谁就成为所有者。如果发生这种情况，请更换 ADMIN_SECRET，\n重新打开此页面并使用新链接。在链接被使用之前，可以重复打开此页面。',
  'setup.done.eventTitle': '2. 创建活动',
  'setup.done.eventText': '在与机器人的聊天中点“🎁 圣诞老人” → “🎄 创建”。每个活动都有自己的邀请链接，可以\n直接在应用中复制或发送到聊天（活动的“管理”页面）。',
};
