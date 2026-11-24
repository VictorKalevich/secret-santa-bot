// Texts of src/support.js (061, English): participant support requests to organizers (012). {name}, {author}, {to} —
// names (HTML already escaped), {title} — event name in quotes, {text} — message text.
export default {
  // Refusals
  'support.noRecipients': 'There’s no one to answer the request right now.',
  'support.closed': 'The request is already closed.',
  'support.notFound': 'Request not found.',
  'support.ownThread': 'This is your own request — someone else can take it.',
  'support.sendFailed': 'Couldn’t send — try again.',
  'support.noOpen': 'There’s no open request.',
  'support.hidden': '{name} is handling the request — only they and the owner see the conversation.',
  'support.alreadyTaken': '{name} has already taken the request.',
  'support.takeOwn': 'You can’t take your own request.',
  'support.ledBy': '{name} is handling the request.',
  'support.passRights': 'Only the person handling the request or the owner can hand it over.',
  'support.passTarget': 'You can hand it over to the owner or another admin.',
  'support.alreadyLed': '{name} is already handling the request.',
  'support.passRace': 'The request changed at the same time as this action — refresh the screen and try again.',
  'support.closeRights': 'Only the person handling the request or the owner can close it.',
  // Assignee without a name (event screen counters)
  'support.assigneeFallback': 'assignee',
  // Buttons under notifications
  'support.openButton': '💬 Open',
  'support.takeButton': '🙋 Take',
  // Who replied or closed — to the participant ({role})
  'support.role.owner': 'Owner',
  'support.role.admin': 'Admin',
  // Notifications to organizers
  'support.notice.opened': '🆘 <b>{name}</b> needs help in {title}:\n\n{text}',
  'support.notice.added': '💬 <b>{name}</b> adds to their request ({title}):\n\n{text}',
  'support.notice.writes': '💬 <b>{name}</b> writes in a support request ({title}):\n\n{text}',
  'support.notice.closedByUser': '✅ <b>{name}</b> closed their support request ({title}).',
  'support.notice.taken': '🙋 <b>{name}</b> took the support request from <b>{author}</b> ({title}).',
  'support.notice.passedToYou': '↪️ <b>{name}</b> handed you the support request from <b>{author}</b> ({title}).',
  'support.notice.passed': '↪️ <b>{name}</b> handed over the support request from <b>{author}</b> ({title}) — <b>{to}</b> is handling it now.',
  'support.notice.closed': '✅ <b>{name}</b> closed the support request from <b>{author}</b> ({title}).',
  'support.notice.returned': '🔄 The support request from <b>{author}</b> ({title}) is unassigned again.',
  // Notifications to the participant
  'support.user.taken': '🙋 <b>{name}</b> took your support request in {title} — the reply will come here.',
  'support.user.reply': '💬 {role} <b>{name}</b> replies ({title}):\n\n{text}',
  'support.user.passed': '↪️ <b>{name}</b> is now handling your support request in {title}.',
  'support.user.closed': '✅ {role} <b>{name}</b> closed your support request in {title}. If you still have a question, just write again.',
  'support.user.returned': '🔄 Your support request in {title} is waiting for a reply again.',
};
