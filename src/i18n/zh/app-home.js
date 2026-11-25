// Texts of app part 03-home (060): the "My events" home screen and the "New event" sheet (063)
export default {
  // Leaving an event or a tab (058): asks only about what is not saved by itself
  'app.home.unsaved': '心愿信还没保存。不保存就离开吗？',
  // Error screen on an event, back to the list
  'app.home.toEvents': '返回活动列表',
  // Shared labels (also on the event screen)
  'app.home.you': '（你）',
  // Event state: list labels; "running" is also the "Status" row on "Info"
  'app.home.finished': '已结束',
  'app.home.active': '进行中',
  'app.home.notMember': '你未参加',
  // Home screen (063): running and finished events; {n} - number of finished ones
  'app.home.greet': '你好，{name}！',
  'app.home.going': '进行中',
  'app.home.done': '已结束 · {n}',
  'app.home.empty.create': '还没有活动。创建你自己的活动（按钮在下方），或者索取活动的邀请链接。',
  'app.home.empty.join': '你还没有参加任何活动。请索取活动的邀请链接。',
  // Bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': '你以机器人所有者的身份在这里：活动的名单中没有你，发给管理员的消息也不会发给你。你的修改会记录在活动日志中。',
  // New event (007: from a template; 063: the creator is the owner, limit); {year} is the next year
  'app.home.create.button': '🎄 创建活动',
  'app.home.create.title': '新活动',
  'app.home.create.hint': '写下活动名称',
  'app.home.create.name': '活动名称',
  'app.home.create.placeholder': '{year} 新年 · 家人',
  'app.home.create.noTemplate': '不用模板，从头开始',
  'app.home.create.fromTemplate': '模板：{title}',
  'app.home.create.invite': '邀请模板活动的参与者',
  'app.home.create.templateHint': '会从模板复制预算、地点、备注、抽签规则和排除规则，不复制日期。',
  'app.home.create.participate': '我也参加',
  // Limit (063): {n} - how many more are allowed; {limit} - the limit per 12 months, {date} - when a slot frees up
  'app.home.create.left': {
    other: '12 个月内还可以创建 {n} 个活动。',
  },
  'app.home.create.full': '12 个月内最多可以创建 {limit} 个活动。下一个活动可于{date}起创建。',
  'app.home.create.done': '🎄 活动已创建',
  'app.home.create.doneInvited': '🎄 活动已创建，已发出邀请：{count}',
  'app.home.create.doneInviteError': '🎄 活动已创建。{error}',
};
