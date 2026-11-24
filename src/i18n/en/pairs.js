// Texts of src/pairs.js (061, English): the draw, adding and removing people, canceling, swapping giftees
export default {
  // Why the draw is impossible (pairs.reason.<problem type of draw.js>); {name} — participant name
  'pairs.reason.too_few': 'At least 2 participants are needed.',
  'pairs.reason.ring_too_few': 'A ring draw needs at least 3 participants — or turn off the ring draw in the settings.',
  'pairs.reason.ring_impossible': 'It looks like mutual pairs can’t be avoided with these exclusions. Try again; if it doesn’t work, remove some exclusions or turn off the ring draw.',
  'pairs.reason.no_receivers': '{name} can’t give to anyone — check the exclusions.',
  'pairs.reason.no_givers': '{name} can’t be anyone’s giftee — check the exclusions.',
  'pairs.reason.search_exhausted': 'Couldn’t find a match quickly — try again. If it doesn’t work, remove some exclusions or turn off the ring draw.',
  'pairs.reason.fixed_block': 'The fixed pairs get in the way: with them, it’s impossible to match everyone by the rules. {owner.nomCap} can remove some of the fixed pairs.',
  'pairs.reason.too_strict': 'Too many exclusions: it’s impossible to match everyone and follow them all. Remove some exclusions.',
  // Families block the draw
  'pairs.familiesBlock': 'The families get in the way: family members don’t give to each other, and it’s impossible to match everyone that way. Turn off “Keep families apart” or the ring draw.',
  // The draw
  'pairs.drawn': '🎄 <b>The draw in {title} is done!</b>\n\nOpen the app and check the “Giftee” tab to find out who you’re giving a gift to. Don’t tell anyone 🤫',
  'pairs.drawnButton': '🎁 See my giftee',
  'pairs.drawFinished': 'The event has finished.',
  'pairs.drawRace': 'Participants, exclusions or families changed during the draw — try again.',
  'pairs.notDrawn': 'The draw hasn’t happened.',
  // Pairs after a change of participants: to a new participant and to a Santa with a new giftee
  'pairs.inserted': '🎄 <b>You’re in the game!</b> You’ve been added to the draw in {title} — check the “Giftee” tab 🤫',
  'pairs.newWard': '🔄 The participants of {title} have changed, and you now have a <b>new giftee</b>. Check the “Giftee” tab.',
  'pairs.lookButton': '🎁 Take a look',
  // Removing and adding a participant
  'pairs.notMember': 'This person isn’t a participant in this event.',
  'pairs.removeBlocked': 'Can’t remove the participant without breaking the exclusions or the ring draw. Relax the exclusions.',
  'pairs.removed': 'You were removed from {title}. If this is a mistake, contact the owner or an admin.',
  'pairs.alreadyInDraw': 'The participant is already in the draw.',
  'pairs.insertBlocked': 'Can’t add the participant without breaking the rules: gifts are already ready for everyone whose giftee could change, or exclusions get in the way. You can cancel the draw in the danger zone and run it again.',
  // Swapping giftees (048): rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': 'One of the two gives to the other: after the swap, someone would give to themselves.',
  'pairs.swapRule.exclusion': 'Exclusions: one of the two would give to someone they shouldn’t give to.',
  'pairs.swapRule.family': 'Families: one of the two would give to a member of their own family.',
  'pairs.swapRule.ring': 'Ring draw: a mutual pair would appear — two people would give to each other.',
  'pairs.swapRule.fixed': 'Fixed pairs: the swap would break a pair you fixed.',
  'pairs.swapRule.history': 'Past pairs: one of the two would give to the same person as in the previous event.',
  'pairs.swapRevealed': 'The secret has already been revealed — giftees can’t be changed.',
  'pairs.swapTwo': 'Choose two different participants.',
  'pairs.notInDraw': 'The participant isn’t in the draw.',
  'pairs.swapStale': 'The pairs have already changed — open the swap again.',
  'pairs.swapSelf': 'These two can’t be swapped — choose another pair.',
  'pairs.swapRulesChanged': 'The draw rules for this swap have changed — check again.',
  'pairs.swapNotice': '🔄 The owner changed the draw in {title}: you now have a <b>new giftee</b>. Your previous pair no longer applies, and its chat has been deleted. Check the “Giftee” tab.',
  // Canceling the draw (007) and force-canceling (012)
  'pairs.cancelFinished': 'The event has finished — the draw can’t be canceled.',
  'pairs.cancelRevealed': 'The secret has already been revealed — the draw can’t be canceled.',
  'pairs.cancelBlocked': 'Can’t cancel: someone has already opened their giftee or a chat has started.',
  'pairs.cancelled': '↩️ <b>The draw has been canceled</b> in {title}. Your letter to Santa is saved. The bot will let you know when there’s a new draw.',
  'pairs.forceCancelled': '↩️ The owner <b>canceled the draw</b> in {title}. Your previous pair no longer applies, and your chats with Santa and your giftee have been deleted. Your letter is saved. The bot will let you know when there’s a new draw.',
  // Log details
  'pairs.auditText.members': 'participants: {n}',
  'pairs.auditText.changed': 'pairs changed: {n}',
  'pairs.auditText.removed': 'pairs removed: {n}',
};
