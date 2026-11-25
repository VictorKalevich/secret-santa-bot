// Texts of src/roles.js (060): bot owner, event owner and admins (063), participation transfer. {name}, {from}, {to},
// {actor}, {who} in messages - names (HTML), {title} - the event title in quotes (HTML)
export default {
  // App button under a message about new rights
  'roles.openButton': '🛠 打开',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ 机器人所有者的权限已通过设置页面的链接转给 <b>{name}</b>。你的活动仍归你所有。\n\n如果这不是你本人或事先商量好的，请更换 ADMIN_SECRET（见 README），打开设置页面，并通过新的所有者链接重新获取权限。',
  'roles.botOwner.transferred': '👑 <b>你已获得机器人所有者的权限。</b>机器人日志、所有活动和权限转让都在应用中：⚙️ “设置” → “机器人所有者”。',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> 现在是机器人所有者。',
  // Passing the bot owner rights
  'roles.transferTarget': '所有者身份只能转让给已报名的人。',
  'roles.alreadyOwnerSelf': '你已经是所有者了。',
  'roles.alreadyTransferred': '所有者身份已经转让了。',
  // Event admins
  'roles.alreadyAdmin': '对方已经是管理员了。',
  'roles.notAdmin': '对方不是管理员。',
  'roles.grantMember': '只能任命活动的参与者。',
  'roles.revokeOwner': '不能撤销所有者的权限。请先转让活动所有者身份。',
  'roles.granted': '🛠 <b>你已被任命为活动 {title} 的管理员。</b>\n\n现在你可以管理这个活动：邀请、排除规则、抽签、提醒。只有活动所有者能在后台查看中看到配对。',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> 现在是活动 {title} 的管理员。',
  'roles.revoked': '你在活动 {title} 中的管理员权限已被撤销。如果你参加了这个活动，可以照常参加游戏。',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> 不再是活动 {title} 的管理员。',
  // Event ownership
  'roles.owner.already': '对方已经是所有者了。',
  'roles.owner.target': '所有者身份只能转让给活动的参与者或管理员。',
  'roles.owner.alreadyPassed': '所有者身份已经转让了。',
  'roles.owner.toNew': '👑 <b>你现在是活动 {title} 的所有者。</b>你可以任命管理员、打开后台查看、重置和删除活动，这些都在应用中。',
  'roles.owner.toPrev': 'ℹ️ 活动 {title} 的所有者身份已转给 <b>{who}</b>。你仍然是管理员。',
  'roles.owner.notice': 'ℹ️ 活动 {title} 的所有者现在是 <b>{who}</b>。',
  // Moving participation to a new account
  'roles.transfer.twoRecords': '请选择两条不同的记录。',
  'roles.transfer.staffTarget': '不能把参与记录转移到所有者或管理员的账号。',
  'roles.transfer.noOld': '找不到旧记录。',
  'roles.transfer.unregistered': '新账号需要先完成报名（把名字发给机器人）。',
  'roles.transfer.inDraw': '新账号已经参加了活动“{title}”的抽签，请选择另一条记录。',
  'roles.transfer.toNew': '🔁 机器人所有者已把你在“神秘圣诞老人”中的参与记录转移到这个账号：心愿信、收礼人、聊天记录和活动历史都保留着。',
  'roles.transfer.toOld': '🔁 你在“神秘圣诞老人”中的参与记录已转移到账号 <b>{to}</b>。如果你没有申请转移，请联系机器人所有者。',
  'roles.transfer.notice': '🔁 <b>{actor}</b> 把 <b>{from}</b> 的参与记录转移到了账号 <b>{to}</b>。',
  // Log: new owner; move "old record -> new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
