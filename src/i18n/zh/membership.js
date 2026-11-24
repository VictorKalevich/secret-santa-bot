// Texts of src/membership.js (060): joining, join requests, families, "I take part", leaving
export default {
  // Families (008): rules and freezing members while a drawn event is running (009)
  'membership.familyNameRule': '家庭名称应为 1 到 40 个字符。',
  'membership.familySize': '家庭成员应为 2 到 {max} 人。',
  'membership.familyNotFound': '找不到家庭。',
  'membership.memberNotFound': '找不到参与者。',
  'membership.alreadyInFamily': '{name} 已经在家庭“{family}”中了。',
  'membership.familyFrozen': '活动“{title}”已经抽签且仍在进行，暂时不能修改家庭成员：否则可以根据参与者的变动推算出配对。请在活动结束后再修改。',
  // Log: family name and members, "I take part"
  'membership.audit.familySave': '“{name}”：{people}',
  'membership.audit.familyDelete': '“{name}”',
  'membership.audit.isParticipant': '参加',
  'membership.audit.notParticipant': '不参加',
  'membership.afterDraw': '抽签后不能这样操作。请让{owner.gen}把你加入抽签。',
  // Participant leaving (035)
  'membership.leaveAfterDraw': '已经抽过签了。想退出的话，请联系所有者或管理员。',
  'membership.leaveFinished': '活动已结束，不能再退出。',
  'membership.leaveNotice': '🚪 <b>{name}</b> 退出了活动 {title}。',
  'membership.openEventButton': '🛠 打开活动',
  // Returning removed people (010)
  'membership.notRemoved': '这个人不在已移除名单中。',
  // Joining and requests (008)
  'membership.joinedNotice': '👋 <b>{name}</b> 加入了活动 {title}',
  'membership.request': '🙋 <b>{name}</b> 想参加活动 {title}。',
  'membership.requestWithUsername': '🙋 <b>{name}</b>（@{username}）想参加活动 {title}。',
  'membership.acceptButton': '✅ 通过',
  'membership.rejectButton': '❌ 拒绝',
  'membership.requestNotFound': '找不到申请。',
  'membership.requestDecided': '申请已经处理过了。',
  'membership.approveFinished': '活动已结束，不能再接收新成员。',
  'membership.approveClosed': '活动“{title}”已停止报名，请先开放报名再通过申请。',
  // Decision on a request: to the participant and to the other admins
  'membership.approvedAfterDraw': '🎉 申请已通过，你加入了活动 {title}！抽签已经完成，{owner.nom}会把你加入抽签，届时机器人会通知你。现在先给圣诞老人写心愿信吧。',
  'membership.approved': '🎉 申请已通过，你加入了活动 {title}！打开应用，给你的神秘圣诞老人写心愿信吧。',
  'membership.requestRejected': '你参加活动 {title} 的申请被拒绝了。如果这是误操作，请联系所有者或管理员。',
  'membership.approvedBy': '✅ <b>{by}</b> 通过了 <b>{name}</b> 参加活动 {title} 的申请。',
  'membership.rejectedBy': '❌ <b>{by}</b> 拒绝了 <b>{name}</b> 参加活动 {title} 的申请。',
};
