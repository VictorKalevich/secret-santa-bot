// Texts of src/constraints.js (060): exclusions and the owner's fixed pairs
export default {
  'constraints.twoPeople': '请选择两个不同的人',
  // Exclusions
  'constraints.exclusionsFrozen': '抽签后不能修改排除规则：否则可以根据参与者的变动推算出配对。要修改排除规则，请取消抽签（在还没有人查看收礼人之前）。',
  'constraints.exclusionMembers': '排除规则只能设置在本活动的参与者之间。',
  // Fixed pairs (014, 031); {santa} and {ward}: the fixed pair, {name}: a participant
  'constraints.fixedFrozen': '抽签后不能修改固定配对。要修改，请取消抽签。',
  'constraints.fixedMembers': '固定配对只能设置在本活动的参与者之间。',
  'constraints.ringOneWay': '环形抽签时，配对只能单向固定。',
  'constraints.ringReverse': '环形抽签时，配对只能单向固定：“{santa}”已固定送礼给“{ward}”。',
  'constraints.santaTaken': '“{name}”已经有固定的收礼人了，请先移除那个配对。',
  'constraints.wardTaken': '“{name}”的圣诞老人已经固定了，请先移除那个配对。',
  'constraints.fixedChanged': '固定配对刚刚有变化，请刷新页面后重试。',
};
