// Texts of src/stale.js (060): warning about auto finishing an abandoned event (056). Reasons follow the owner's
// rules: date (A), empty (G), age (B)
export default {
  // {when}: finish date, {why}: stale.why.<reason>, {keep}: stale.keep.<reason>
  'stale.warning': '⏳ <b>活动 {title} 将于{when}自动结束。</b>\n{why}\n\n{keep}',
  'stale.openButton': '⚙️ 打开活动',
  // Why the event is considered abandoned
  'stale.why.date': '送礼日期（{date}）已经过了。',
  'stale.why.empty': '除了所有者和管理员，还没有其他人加入。',
  'stale.why.age': '活动没有送礼日期，而且创建已超过三个月。',
  // How to keep the event
  'stale.keep.date': '如果还需要这个活动，请修改送礼日期：“管理” → “设置”。',
  'stale.keep.empty': '如果还需要这个活动，请邀请参与者或设置送礼日期：“管理” → “设置”。',
  'stale.keep.age': '如果还需要这个活动，请设置送礼日期：“管理” → “设置”。',
  // Log detail of finish.warn (stale.auditText): {why} is stale.logged.<reason>
  'stale.auditText': '{why}；将于{when}结束',
  'stale.logged.date': '送礼日期已过',
  'stale.logged.empty': '除所有者和管理员外无人加入',
  'stale.logged.age': '没有送礼日期',
};
