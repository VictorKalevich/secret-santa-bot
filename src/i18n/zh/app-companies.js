// Texts of app part 04-companies (060): "Rooms" screen, "Room" sheet, owner link, bot owner rights.
// In texts for people it is a "room" (059)
export default {
  // Person's role in a room row
  // "Rooms" screen
  'app.companies.title': '房间',
  'app.companies.empty': '还没有房间。创建一个自己的房间，或者索取活动的邀请链接。',
  'app.companies.emptyBotOwner': '还没有房间。',
  'app.companies.create': '🚪 创建房间',
  'app.companies.ownLimit': '你最多只能管理两个自己的房间，请转让或删除其中一个。',
  'app.companies.botLog': '📜 机器人日志',
  // Room row: owner, number of events; buttons "✏️" and "⚙️"
  'app.companies.about': '所有者：{owner} · 活动：{events}',
  'app.companies.aboutIdle': '所有者：{owner} · 活动：{events} · 无进行中的活动',
  'app.companies.roomName': '房间名称',
  'app.companies.ownName': '仅自己可见的名称',
  'app.companies.settings': '房间',
  // Name sheet
  'app.companies.label.field': '名称',
  'app.companies.label.shared': '房间里的所有人都能看到这个名称。',
  'app.companies.label.botOwner': '只有你（机器人所有者）能看到房间名称。',
  'app.companies.label.own': '只有你能看到这个名称。',
  'app.companies.label.saved': '名称已保存',
  // New room
  'app.companies.new.title': '新房间',
  'app.companies.new.placeholder': '例如：同事',
  'app.companies.new.done': '🚪 房间已创建',
  'app.companies.new.hintOwn': '你将成为房间所有者：可以创建活动、邀请好友、任命管理员。房间里的所有人都能看到名称。',
  'app.companies.new.hintBot': '每个房间都有自己的成员、活动、家庭和管理员。你可以自己管理，也可以通过链接交给所有者。',
  // Bot owner's "Room" sheet: who runs it
  'app.companies.lead.title': '由谁管理',
  'app.companies.lead.you': '你',
  'app.companies.lead.botRun': '这个房间没有自己的所有者：由你管理。',
  'app.companies.lead.owner': '房间所有者：管理员、重置和删除活动、后台查看配对。',
  'app.companies.lead.self': '自己管理',
  'app.companies.lead.selfConfirm': '自己管理这个房间？“{name}”仍然是管理员。',
  'app.companies.lead.selfDone': '房间又由你管理了',
  // Room owner link
  'app.companies.link.title': '🔗 房间所有者链接',
  'app.companies.link.hint': '链接只能使用一次：谁先打开，谁就成为房间所有者，并能查看房间内活动的配对。请私下发送。',
  'app.companies.link.active': '链接有效。链接不能再次显示，但可以创建新的。',
  'app.companies.link.copy': '📋 复制',
  'app.companies.link.shareText': '👑 “神秘圣诞老人”的所有者链接：打开它即可管理你的房间。',
  'app.companies.link.create': '创建链接',
  'app.companies.link.renew': '创建新链接',
  'app.companies.link.revoke': '撤销',
  'app.companies.link.revoked': '链接已撤销',
  // Deleting an empty room (sheet with a confirmation word)
  'app.companies.delete.section': '删除',
  'app.companies.delete.hasEvents': '房间里还有活动，请先删除它们。',
  'app.companies.delete.button': '🗑 删除房间',
  'app.companies.delete.title': '删除房间',
  'app.companies.delete.lines': ['房间的成员、管理员和家庭；', '房间的公共日志。'],
  'app.companies.delete.keepBot': '房间里没有活动。房间所有者和管理员会收到通知。',
  'app.companies.delete.keepOwn': '房间里没有活动。房间管理员会收到通知。',
  'app.companies.delete.done': '房间已删除',
  // Pass bot owner rights
  'app.companies.botOwner.pass': '👑 转让机器人所有者身份',
  'app.companies.botOwner.title': '机器人所有者权限',
  'app.companies.botOwner.hint': '机器人所有者只有一位。可以转让给你所管理房间中的人。',
  'app.companies.botOwner.choose': '转让给谁…',
  'app.companies.botOwner.confirm': '把机器人所有者身份转让给“{name}”？对方将可以创建和删除房间，并任命房间所有者。你仍然是自己房间的管理员。',
  'app.companies.botOwner.done': '👑 机器人所有者身份已转让',
};
