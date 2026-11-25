// Texts of src/events.js (060): creation, finishing, deletion, reset, invitations, reveal, reminders, announcements,
// event parameters
export default {
  'events.titleRule': '活动名称应为 1 到 80 个字符。',
  // Creating (063): who can and the limit; {limit} - the limit per 12 months, {date} - when a slot frees up
  'events.createRight': '在这个机器人中，只有机器人所有者和得到其允许的人可以创建活动。',
  'events.limit': '12 个月内最多可以创建 {limit} 个活动。下一个活动可于{date}起创建。',
  // Shared app button under an event message (also in src/pairs.js)
  'events.openButton': '🎁 打开',
  // Finishing
  'events.alreadyFinished': '活动已经结束了。',
  'events.finished': '🏁 <b>活动 {title} 已结束。</b>谢谢参与！\n\n给圣诞老人的心愿信现在只能查看。聊天还会开放 7 天（到 {until}），之后只能查看。活动记录会保存在应用中。',
  'events.finishedButton': '📚 打开',
  // Deletion and full reset
  'events.deleted': '🗑 活动 {title} 已被所有者删除，心愿信和聊天记录也一并删除。',
  'events.alreadyDeleted': '活动已经删除了。',
  'events.reset': '🎄 所有者重新开始了活动 {title}，之前的数据已删除。想参加的话，请索取新的邀请链接。',
  'events.resetRace': '活动已被重置，或在重置的同时发生了变化，请刷新页面。',
  // Inviting participants of another event
  'events.registrationClosed': '报名已关闭，请先开放报名再邀请。',
  'events.setupFirst': '请先打开设置页面 /setup（见 README）。',
  'events.invite': '📨 <b>活动 {title} 的邀请</b> · 神秘圣诞老人。\n点击按钮参加。',
  'events.inviteButton': '🎄 参加',
  'events.inviteAgain': '邀请已经发出，一分钟后才能再发。',
  // Reveal: {name} the Santa name
  'events.alreadyRevealed': '谜底已经揭晓了。',
  'events.revealed': '🎅 <b>谜底揭晓！</b>\n\n在活动 {title} 中，你的神秘圣诞老人是 <b>{name}</b>。节日快乐！🎄',
  // Reminders: empty letter (with and without a deadline) and to Santas (with and without a gift date)
  'events.remindAgain': '提醒已经发出，一分钟后才能再发。',
  'events.remindUnfilled': '⏰ 提醒：你在活动 {title} 中给圣诞老人的心愿信还是空的。写一写吧，这样圣诞老人更容易挑选礼物。',
  'events.remindUnfilledBy': '⏰ 提醒：你在活动 {title} 中给圣诞老人的心愿信还是空的。请在 <b>{date}</b> 之前写好，这样圣诞老人更容易挑选礼物。',
  'events.remindSantas': '🎁 给圣诞老人的提醒（{title}）：给收礼人的礼物准备好了吗？\n准备好后，请在“收礼人”页面标记一下。',
  'events.remindSantasDated': '🎁 给圣诞老人的提醒（{title}）：给收礼人的礼物准备好了吗？送礼日期：<b>{date}</b>。\n准备好后，请在“收礼人”页面标记一下。',
  // Announcements (007)
  'events.announceFinished': '活动已结束，不能再发送公告。',
  'events.announceEmpty': '请写下公告内容。',
  'events.announcement': '📣 <b>公告 · {title}</b>\n\n{text}',
  'events.announcementButton': '📌 打开活动',
  'events.announceAgain': '这条公告已经发送过了。',
  // Parameters
  'events.ringAfterDraw': '抽签后不能修改环形抽签。',
  // Log details
  'events.auditText.fromTemplate': '以“{title}”为模板',
  'events.auditText.deleted': '“{title}”，参与者：{n}',
  'events.auditText.reset': '移除的参与者：{n}',
  'events.auditText.invited': '来自“{title}”，已邀请：{n}',
  'events.auditText.pairs': '配对：{n}',
  'events.auditText.received': '已收到：{n}',
  'events.auditText.settings': '设置',
  'events.auditText.ring': '环形抽签：{state}',
  'events.auditText.avoidPrevious': '不重复以往配对：{state}',
  'events.auditText.on': '开',
  'events.auditText.off': '关',
  'events.auditText.registrationOpen': '已开放',
  'events.auditText.registrationClosed': '已关闭',
};
