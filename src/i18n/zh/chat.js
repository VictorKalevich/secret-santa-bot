// Texts of src/chat.js (060): chat between Santa and giftee
export default {
  // "Too long" refusal for the letter, chats and requests: {max} is MAX_CHARS
  'chat.tooLong': '太长了：{n} 个字符，最多 {max} 个（Telegram 消息长度限制）。',
  'chat.empty': '消息是空的。',
  'chat.noWard': '你还没有收礼人。',
  'chat.noSanta': '你还没有参与抽签。',
  'chat.pairChanged': '配对已变化，请刷新页面。',
  'chat.pairChangedReply': '🔄 你点了“回复”之后配对发生了变化，消息未发送。请再点一次“↩️ 回复”。',
  // How the giftee sees Santa in bot messages: without and with a mask (040)
  'chat.santaTitle': '你的神秘圣诞老人',
  'chat.santaTitleMask': '你的神秘圣诞老人“{mask}”',
  // Message to the other side: {santa} is chat.santaTitle*, {title} the event title, {text} the message text
  'chat.fromSanta': '💬 <b>{santa}（{title}）说：</b>\n\n{text}',
  'chat.fromWard': '💬 <b>你的收礼人（{title}）说：</b>\n\n{text}',
  'chat.historyButton': '💬 全部聊天记录',
};
