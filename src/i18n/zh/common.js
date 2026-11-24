// Common server texts (060): dates, names, who may do an owner action, common refusals.
export default {
  // Date "11月25日"
  'common.date': '{month}{day}日',
  'common.monthsGen': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  // A person without a name and username
  'common.someone': '某人',
  // Who may do an owner action (ownerWord): room with an assigned owner and room of the bot owner
  'common.owner.nom': '所有者',
  'common.owner.gen': '所有者',
  'common.owner.dat': '所有者',
  'common.owner.ins': '所有者',
  'common.owner.nomCap': '所有者',
  'common.botOwner.nom': '机器人所有者',
  'common.botOwner.gen': '机器人所有者',
  'common.botOwner.dat': '机器人所有者',
  'common.botOwner.ins': '机器人所有者',
  'common.botOwner.nomCap': '机器人所有者',
  // Default app button under a message
  'common.openApp': '🎁 打开应用',
  // Common refusals
  'common.notRegistered': '请先通过邀请链接报名。',
  'common.adminOnly': '仅限管理员。',
  'common.noDraw': '还没有抽签。',
  'common.pairsRace': '配对在你操作的同时发生了变化，请重试。',
  'common.notMember': '你没有参加这个活动。',
  'common.companyNotFound': '找不到房间。',
  // shared (060: same text with one meaning, one key)
  'common.writeLetterButton': '✏️ 写心愿信',
  'common.replyButton': '↩️ 回复',
  'common.tooLong': '太长了：{n} 个字符，最多 {max} 个。',
};
