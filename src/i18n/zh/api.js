// Texts of src/api.js (060): check pipeline and action handlers. {owner.nom}, {owner.dat}: "owner" or "bot owner"
// (ownerWord); {word}: the confirmation word of the action.
export default {
  'api.badInitData': '无法验证登录。请从与机器人的聊天中重新打开应用。',
  'api.unknownAction': '未知操作',
  'api.noEvent': '找不到活动。',
  'api.chooseRoom': '请选择房间。',
  // What is not allowed in a finished event (field finished of the actions table)
  'api.closed': '活动已结束，不能再修改（仍可查看、揭晓和删除）。',
  'api.letterClosed': '活动已结束：心愿信现在只能查看。',
  'api.markClosed': '活动已结束：标记只能查看。',
  'api.maskClosed': '活动已结束：面具不能再更换。',
  // Confirmation word (field confirm): refusal without the word
  'api.confirm.delete': '要删除，请输入“{word}”。',
  'api.confirm.leave': '要退出，请输入“{word}”。',
  'api.confirm.cancel': '要取消，请输入“{word}”。',
  'api.confirm.reset': '要完全重置，请输入“{word}”。',
  'api.confirm.vault': '要进入后台查看，请输入“{word}”。',
  // Refusal to a non-owner (field owner): api.owner.* with the room ownerWord, api.botOwner.* always the bot owner
  'api.owner.roles': '只有{owner.nom}可以任命和撤销管理员。',
  'api.owner.vault': '只有{owner.dat}可以使用后台查看。',
  'api.owner.swap': '抽签后只有{owner.nom}可以更换收礼人。',
  'api.owner.transfer': '只有{owner.nom}可以转让所有者身份。',
  'api.owner.insert': '抽签后只有{owner.nom}可以把人加入抽签。',
  'api.owner.fixed': '只有{owner.nom}可以设置固定配对。',
  'api.owner.forceCancel': '只有{owner.nom}可以强制取消抽签。',
  'api.owner.eventDelete': '只有{owner.nom}可以删除活动。',
  'api.owner.reset': '只有{owner.nom}可以完全重置。',
  'api.botOwner.transfer': '只有机器人所有者可以把参与记录转移到新账号。',
  'api.botOwner.companyDelete': '只有机器人所有者可以删除房间。',
  'api.botOnly': '仅限机器人所有者。',
  // Handlers
  'api.nameRule': '名字应为 1 到 40 个字符',
  // 061: language choice, a code not from the bot languages
  'api.lang.unknown': '没有这种语言。',
  'api.templateNotFound': '找不到模板。',
  'api.memberNotFound': '找不到参与者',
  'api.renameAdmin': '只有{owner.nom}可以给管理员改名。',
  'api.renameSelfOnly': '这个人的名字由本人修改：“个人资料” → “✏️ 修改名字”。',
  'api.ownerNotTransferred': '所有者的记录不能转移：所有者需通过新的所有者链接恢复访问（更换 ADMIN_SECRET → 打开 /setup 页面）。',
  'api.removeSelf': '不能移除自己，请关闭“我参加”。',
  'api.removeOwner': '不能把所有者从活动中移除。所有者需先转让所有者身份。',
  'api.removeAdmin': '只有{owner.nom}可以移除管理员。',
  'api.drawDone': '已经抽过签了。',
  'api.chooseOtherEvent': '请选择另一个活动。',
  'api.inviteFinished': '活动已结束，不能再邀请人加入。',
};
