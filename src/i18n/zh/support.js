// Texts of src/support.js (060): participant requests to organizers (012). {name}, {author}, {to} are names (HTML
// already escaped), {title} the event title in quotes, {text} the message text.
export default {
  // Refusals
  'support.noRecipients': '现在没有人能回复求助。',
  'support.closed': '求助已经关闭了。',
  'support.notFound': '找不到求助。',
  'support.ownThread': '这是你自己的求助，需要由其他人负责。',
  'support.sendFailed': '发送失败，请重试。',
  'support.noOpen': '没有未关闭的求助。',
  'support.hidden': '这个求助由 {name} 负责，只有对方和所有者能看到对话。',
  'support.alreadyTaken': '{name} 已经接手了这个求助。',
  'support.takeOwn': '不能接手自己的求助。',
  'support.ledBy': '这个求助由 {name} 负责。',
  'support.passRights': '只有负责人或所有者可以转交求助。',
  'support.passTarget': '只能转交给所有者或其他管理员。',
  'support.alreadyLed': '这个求助本来就由 {name} 负责。',
  'support.passRace': '求助在你操作的同时发生了变化，请刷新页面后重试。',
  'support.closeRights': '只有负责人或所有者可以关闭求助。',
  // Assignee without a name (event screen counters)
  'support.assigneeFallback': '负责人',
  // Buttons under notifications
  'support.openButton': '💬 打开',
  'support.takeButton': '🙋 接手',
  // Who replied or closed, to the participant ({role})
  'support.role.owner': '所有者',
  'support.role.admin': '管理员',
  // Notifications to organizers
  'support.notice.opened': '🆘 <b>{name}</b> 在活动 {title} 中请求帮助：\n\n{text}',
  'support.notice.added': '💬 <b>{name}</b> 补充了求助（{title}）：\n\n{text}',
  'support.notice.writes': '💬 <b>{name}</b> 在求助中写道（{title}）：\n\n{text}',
  'support.notice.closedByUser': '✅ <b>{name}</b> 关闭了求助（{title}）。',
  'support.notice.taken': '🙋 <b>{name}</b> 接手了 <b>{author}</b> 的求助（{title}）。',
  'support.notice.passedToYou': '↪️ <b>{name}</b> 把 <b>{author}</b> 的求助（{title}）转交给了你。',
  'support.notice.passed': '↪️ <b>{name}</b> 转交了 <b>{author}</b> 的求助（{title}），现在由 <b>{to}</b> 负责。',
  'support.notice.closed': '✅ <b>{name}</b> 关闭了 <b>{author}</b> 的求助（{title}）。',
  'support.notice.returned': '🔄 <b>{author}</b> 的求助（{title}）又没人负责了。',
  // Notifications to the participant
  'support.user.taken': '🙋 你在活动 {title} 中的求助已由 <b>{name}</b> 接手，回复会发到这里。',
  'support.user.reply': '💬 {role} <b>{name}</b> 回复了（{title}）：\n\n{text}',
  'support.user.passed': '↪️ 你在活动 {title} 中的求助现在由 <b>{name}</b> 负责。',
  'support.user.closed': '✅ {role} <b>{name}</b> 关闭了你在活动 {title} 中的求助。如果还有问题，直接再写就行。',
  'support.user.returned': '🔄 你在活动 {title} 中的求助正在重新等待回复。',
};
