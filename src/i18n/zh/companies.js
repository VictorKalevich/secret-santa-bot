// Texts of src/companies.js (060): rooms (creation, names, room owner, owner link, deletion). Owner rights refusals
// (target, "already the owner", "already transferred") are shared with roles.js, keys roles.*
export default {
  // Refusals
  'companies.ownLimit': '你最多只能管理两个自己的房间，请转让或删除其中一个。',
  'companies.recent': '刚刚已创建了同名的房间。',
  'companies.nameRule': '房间名称应为 1 到 40 个字符。',
  'companies.labelRule': '名称最多 40 个字符。',
  'companies.hasEvents': '房间里还有活动，请先删除它们。',
  'companies.ownDelete': '只有房间所有者可以删除房间。',
  'companies.alreadyOwner': '对方已经是所有者了。',
  // Room owner link (bot: /start own_<code>)
  'companies.ownerLinkGone': '这个所有者链接已被使用或撤销。请索取新的链接。',
  'companies.newOwner': '👑 你是自己“神秘圣诞老人”房间的所有者：可以创建活动、邀请好友、任命管理员。',
  // Room name without an own and a shared name: its number among the person's rooms
  'companies.numbered': '房间 {n}',
  // Room owner change: {who}, {by} are names (HTML), {title} the room name in quotes
  'companies.owner.transferred': '👑 <b>你已获得房间所有者的权限。</b>现在你可以任命和撤销管理员、重置和删除活动、打开后台查看，这些都在应用中。',
  'companies.owner.returned': '👑 <b>{by}</b> 把房间 {title} 交还给你：现在又由你管理了。',
  'companies.owner.prevNext': 'ℹ️ 房间所有者的权限现在归 <b>{who}</b>。你仍然是管理员。',
  'companies.owner.prevBot': 'ℹ️ 房间重新由机器人所有者管理。你仍然是管理员。',
  'companies.owner.byLink': '👑 <b>{who}</b> 现在是房间 {title} 的所有者。',
  'companies.owner.byLinkUsername': '👑 <b>{who}</b>（@{username}）现在是房间 {title} 的所有者。',
  'companies.owner.passed': 'ℹ️ <b>{by}</b> 转让了房间 {title} 的所有者权限：现在的所有者是 <b>{who}</b>。',
  'companies.owner.notice': 'ℹ️ <b>{who}</b> 现在是所有者。',
  // Deleting an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': '所有者删除了你担任管理员的房间：房间里没有活动。',
  'companies.deleted.yours': '机器人所有者删除了你管理的房间：房间里没有活动。',
  'companies.deleted.admin': '机器人所有者删除了你担任管理员的房间：房间里没有活动。',
  // Log: {title} is the room name
  'companies.audit.byLink': '通过链接：{name}',
  'companies.audit.toBotOwner': '→ 机器人所有者',
  'companies.audit.ownerChanged': '“{title}”：{details}',
  'companies.audit.linkRevoked': '“{title}”：已撤销',
  'companies.audit.linkCreated': '“{title}”：已创建',
  'companies.audit.roomDeleted': '“{title}”，人数：{n}',
};
