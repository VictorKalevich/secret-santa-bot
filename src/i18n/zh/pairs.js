// Texts of src/pairs.js (060): draw, inserting, removing, cancelling, swapping giftees
export default {
  // Why the draw is impossible (pairs.reason.<draw.js problem type>); {name} is a participant name
  'pairs.reason.too_few': '至少需要 2 位参与者。',
  'pairs.reason.ring_too_few': '环形抽签至少需要 3 位参与者，或者在设置中关闭环形抽签。',
  'pairs.reason.ring_impossible': '在这些排除规则下，似乎无法避免互相送礼的配对。请再试一次；如果还不行，请删掉部分排除规则或关闭环形抽签。',
  'pairs.reason.no_receivers': '{name} 无法送礼给任何人，请检查排除规则。',
  'pairs.reason.no_givers': '没有人能送礼给 {name}，请检查排除规则。',
  'pairs.reason.search_exhausted': '没能很快找到合适的分配，请再试一次。如果还不行，请删掉部分排除规则或关闭环形抽签。',
  'pairs.reason.fixed_block': '固定配对造成了冲突：有了它们，无法按规则为所有人分配。{owner.nomCap}可以移除部分固定配对。',
  'pairs.reason.too_strict': '排除规则太多了：无法在遵守所有规则的前提下为所有人分配。请删掉部分排除规则。',
  // A participant without a name in a reason
  'pairs.familiesBlock': '家庭规则造成了冲突：同一家庭的成员互不送礼，这样无法为所有人分配。请关闭“考虑家庭”或环形抽签。',
  // Draw
  'pairs.drawn': '🎄 <b>活动 {title} 已完成抽签！</b>\n\n打开应用，在“收礼人”页面看看你要给谁送礼物。不要告诉任何人哦 🤫',
  'pairs.drawnButton': '🎁 查看收礼人',
  'pairs.drawFinished': '活动已结束。',
  'pairs.drawRace': '抽签期间参与者、排除规则或家庭发生了变化，请重试。',
  'pairs.notDrawn': '还没有抽签。',
  // Pairs after a change of members: to the new participant and to Santa with a new giftee
  'pairs.inserted': '🎄 <b>你加入游戏了！</b>活动 {title} 已为你完成抽签，去“收礼人”页面看看吧 🤫',
  'pairs.newWard': '🔄 活动 {title} 的参与者有变动，你现在有了<b>新的收礼人</b>。去“收礼人”页面看看吧。',
  'pairs.lookButton': '🎁 查看',
  // Removing and inserting a participant
  'pairs.notMember': '这个人没有参加这个活动。',
  'pairs.removeBlocked': '无法在不违反排除规则或环形抽签的情况下移除这位参与者。请放宽排除规则。',
  'pairs.removed': '你已被移出活动 {title}。如果这是误操作，请联系所有者或管理员。',
  'pairs.alreadyInDraw': '这位参与者已经在抽签中了。',
  'pairs.insertBlocked': '无法在不违反规则的情况下加入这位参与者：可能更换收礼人的圣诞老人都已备好礼物，或者排除规则造成了冲突。可以在危险区取消抽签后重新抽签。',
  // Swapping giftees (048): rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': '两人中有一人送礼给另一人：交换后会有人送礼给自己。',
  'pairs.swapRule.exclusion': '排除规则：两人中会有人送礼给按规则不该送的人。',
  'pairs.swapRule.family': '家庭：两人中会有人送礼给自己的家人。',
  'pairs.swapRule.ring': '环形抽签：会出现互相送礼的配对，两人会互相送礼。',
  'pairs.swapRule.fixed': '固定配对：交换会拆散你设置的固定配对。',
  'pairs.swapRule.history': '以往配对：两人中会有人送礼给上次活动中送过的同一个人。',
  'pairs.swapRevealed': '谜底已经揭晓，不能再更换收礼人。',
  'pairs.swapTwo': '请选择两位不同的参与者。',
  'pairs.notInDraw': '这位参与者不在抽签中。',
  'pairs.swapStale': '配对已经变化，请重新打开交换。',
  'pairs.swapSelf': '这两人无法交换，请换一对。',
  'pairs.swapRulesChanged': '这次交换涉及的抽签规则已变化，请再检查一次。',
  'pairs.swapNotice': '🔄 所有者调整了活动 {title} 的抽签：你现在有了<b>新的收礼人</b>。之前的配对已失效，相关聊天记录已删除。去“收礼人”页面看看吧。',
  // Cancelling the draw (007) and forced cancel (012)
  'pairs.cancelFinished': '活动已结束，不能取消抽签。',
  'pairs.cancelRevealed': '谜底已经揭晓，不能取消抽签。',
  'pairs.cancelBlocked': '无法取消：已经有人查看了收礼人，或者已经开始聊天。',
  'pairs.cancelled': '↩️ 活动 {title} 的<b>抽签已取消</b>。你给圣诞老人的心愿信仍然保留。重新抽签时，机器人会通知你。',
  'pairs.forceCancelled': '↩️ 所有者<b>取消了活动 {title} 的抽签</b>。之前的配对已失效，与圣诞老人和收礼人的聊天记录已删除。你的心愿信仍然保留。重新抽签时，机器人会通知你。',
  // Log details
  'pairs.auditText.members': '参与者：{n}',
  'pairs.auditText.changed': '已更改配对：{n}',
  'pairs.auditText.removed': '已删除配对：{n}',
};
