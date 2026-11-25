// Texts of src/bot.js (060): chat with the bot (sign-up, menu, links, replies to chats and requests, buttons). {title}:
// event title in quotes (HTML), {name}: a name (HTML, except button labels and answers to a press)
export default {
  // Asking for a name (047: with the Telegram name, the name and buttons)
  'bot.name.prompt': '你叫什么名字？请写下你的名字（需要的话可以写全名），你的圣诞老人、所有者和管理员会看到它。',
  'bot.name.offer': '游戏中的名字：<b>{name}</b>，和 Telegram 中一样。你的圣诞老人、所有者和管理员会看到它。想换一个？点“✏️ 修改名字”，或直接发送新名字。',
  'bot.name.ask': '✏️ 请用一条消息发送你的名字（需要的话可以写全名），最多 40 个字符。你的圣诞老人、所有者和管理员会看到它。',
  'bot.name.saved': '名字已经保存。可以在应用中修改：“⚙️ 设置” → “个人资料” → “✏️ 修改名字”。',
  'bot.name.rule': '请用普通文字发送名字（最多 40 个字符）。',
  'bot.name.join': '✅ 以 {name} 的身份参加',
  'bot.name.continue': '✅ 以 {name} 的身份继续',
  'bot.name.edit': '✏️ 修改名字',
  // Greeting before asking for a name
  'bot.hello': '🎄 你好！这是神秘圣诞老人游戏机器人。',
  'bot.helloEvent': '🎄 你好！这是神秘圣诞老人游戏机器人，活动：{title}。',
  'bot.niceToMeet': '很高兴认识你，{name}！🎉',
  'bot.createFirstEvent': '在应用中创建第一个活动，那里会出现邀请链接。',
  'bot.writeLetterFirst': '现在打开应用，在活动 {title} 中给你的神秘圣诞老人写心愿信：想要什么、喜欢什么、尺码，以及绝对不想要的东西。',
  'bot.closedBot': '🎄 这是一个不公开的神秘圣诞老人游戏机器人。想加入的话，请索取活动的邀请链接。',
  'bot.cancelled': '已取消。',
  // Invite link
  'bot.invite.stale': '这个邀请链接已失效。请索取新的链接。',
  'bot.invite.removed': '你已被移出活动 {title}，不能通过链接回来。如果这是误操作，请联系所有者或管理员。',
  'bot.invite.closed': '活动 {title} 已停止报名。所有者或管理员可以重新开放报名。',
  'bot.invite.member': '🎄 你已经在参加活动 {title} 了。',
  'bot.invite.joined': '🎄 你已加入活动 {title}！打开应用，给你的神秘圣诞老人写心愿信吧。',
  'bot.invite.requestPending': '⏳ 你参加活动 {title} 的申请已经发出，正在等待审核。',
  'bot.invite.requestSent': '⏳ 已发送参加活动 {title} 的申请。审核后我会通知你。',
  // Bot owner link (/setup)
  'bot.ownerLink.used': '所有者链接已被使用。要获取新链接，请更换 ADMIN_SECRET 并重新打开设置页面。',
  'bot.ownerLink.hello': '👑 你是“神秘圣诞老人”机器人的所有者：可以创建活动并任命管理员。',
  'bot.ownerLink.done': '👑 你现在是机器人所有者了：活动和管理员都在应用中。',
  // Former owner link (051) - no longer works (063)
  'bot.ownLink.gone': '这个链接已失效。如果想参加，请索取活动的邀请链接。',
  // Menu
  'bot.menu.title': '🎄 <b>神秘圣诞老人</b>',
  // No running events: can create events (063) - and cannot
  'bot.menu.noEventsCreate': '你目前没有参加任何进行中的活动。可以在应用中创建自己的活动，或者索取活动的邀请链接。',
  'bot.menu.noEvents': '你目前没有参加任何进行中的活动。请索取活动的邀请链接。',
  'bot.menu.events': '你的活动：',
  'bot.menu.event': '• {title} — {letter}，{draw}',
  'bot.menu.letterFilled': '心愿信 ✅',
  'bot.menu.letterEmpty': '心愿信未填写 ✏️',
  'bot.menu.drawAhead': '尚未抽签',
  'bot.menu.wardAssigned': '收礼人已分配 🎁',
  'bot.menu.awaitingInsert': '等待加入抽签',
  'bot.menu.finished': '📚 已结束的活动：{n} 个，记录可在应用中查看。',
  'bot.menu.botOwner': '👑 你是机器人所有者：活动和管理员都在应用中。',
  'bot.menu.toWard': '💬 给收礼人 · {title}',
  'bot.menu.toSanta': '💬 给圣诞老人 · {title}',
  'bot.menu.notify': '🔔 通知',
  // Reply to a chat or a request; {n}: message length limit
  'bot.reply.hint': '最多 {n} 个字符，请在一小时内发送。全部聊天记录在应用中（“💬”按钮）。\n\n/cancel — 取消',
  'bot.reply.expired': '⌛ 回复时间已过，消息未发送。请再点一次“↩️ 回复”，然后重新发送。',
  'bot.reply.tooLong': '❌ 太长了：{n} 个字符，最多 {max} 个。请发短一些，或发送 /cancel。',
  'bot.reply.failed': '❌ {error}',
  'bot.reply.toWardSent': '✅ 已以“神秘圣诞老人”的名义发送给收礼人。',
  'bot.reply.toSantaSent': '✅ 已发送给你的圣诞老人。',
  // "Write a message" hint
  'bot.reply.toWard': '✍️ 给收礼人写条消息（{title}），我会以“神秘圣诞老人”的名义<b>匿名</b>转达。',
  'bot.reply.toSanta': '✍️ 给你的圣诞老人写条消息（{title}），我会转达。圣诞老人知道你是谁，你却不知道对方是谁。',
  // Requests to organizers (012)
  'bot.support.sent': '✅ 消息已发送。回复会发到这里。',
  'bot.support.adminsOnly': '❌ 只有所有者和管理员可以回复求助。',
  'bot.support.answered': '✅ 已发送给参与者。',
  'bot.support.notSent': '❌ {error} 消息未发送。',
  'bot.support.participant': '参与者',
  'bot.support.ask': '✍️ 写一条关于活动的消息（{title}），我会转达。不要透露你的收礼人是谁。',
  'bot.support.takenAnswer': '🙋 这个求助由你负责了',
  'bot.support.taken': '🙋 现在由你负责 <b>{name}</b> 的求助（{title}）。请用下面的按钮或在应用中回复。',
  'bot.support.someoneElse': '其他人',
  'bot.support.answer': '✍️ 写下给 <b>{name}</b> 的回复（求助，{title}）。',
  'bot.support.answerTake': '✍️ 写下给 <b>{name}</b> 的回复（求助，{title}）。回复后，这个求助将由你负责。',
  // Join requests (008)
  'bot.request.approvedAnswer': '✅ 已通过',
  'bot.request.rejectedAnswer': '❌ 已拒绝',
  'bot.request.approved': '✅ 申请已通过：<b>{name}</b>，{title}。',
  'bot.request.rejected': '❌ 申请已拒绝：<b>{name}</b>，{title}。',
  // Notifications about the giftee's letter changes; bot.notify.mode.<mode>
  'bot.notify.title': '收礼人修改心愿信时的通知（所有活动）。\n当前：<b>{mode}</b>',
  'bot.notify.saved': '已保存：{mode}',
  'bot.notify.mode.sound': '🔔 有声音',
  'bot.notify.mode.silent': '🔕 静音',
  'bot.notify.mode.off': '🚫 不通知',
  // 061: /language, language choice; name is the language name in that language
  'bot.lang.choose': '🌐 选择机器人和应用的语言：',
  'bot.lang.auto': '跟随 Telegram（{name}）',
  'bot.lang.saved': '语言：{name}',
};
