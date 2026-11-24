// Texts of src/events.js (061, English): creating, finishing, deleting, resetting, invitations, the reveal, reminders,
// announcements, event settings
export default {
  'events.titleRule': 'The event name must be 1 to 80 characters.',
  // Shared app button under an event message (also in src/pairs.js)
  'events.openButton': '🎁 Open',
  // Finishing
  'events.alreadyFinished': 'The event has already finished.',
  'events.finished': '🏁 <b>The event {title} has finished.</b> Thanks for playing!\n\nThe letter to Santa is now read-only. The chat stays open for 7 more days (until {until}), then becomes read-only. The event’s history is kept in the app.',
  'events.finishedButton': '📚 Open',
  // Deletion and full reset
  'events.deleted': '🗑 The owner deleted the event {title}, along with its letters and chats.',
  'events.alreadyDeleted': 'The event has already been deleted.',
  'events.reset': '🎄 The owner restarted the event {title}. The previous data has been deleted. To take part, ask for a new invite link.',
  'events.resetRace': 'The event has already been reset or changed at the same time as the reset — refresh the screen.',
  // Inviting participants of another event
  'events.registrationClosed': 'Registration is closed — open it to send invitations.',
  'events.setupFirst': 'Open the /setup page first (see README).',
  'events.invite': '📨 <b>Invitation to {title}</b> — Secret Santa.\nTap the button to join.',
  'events.inviteButton': '🎄 Join',
  'events.inviteAgain': 'Invitations have already been sent — you can send them again in a minute.',
  // The reveal: {mask} — Santa's mask (040), {name} — Santa's name
  'events.alreadyRevealed': 'The secret has already been revealed.',
  'events.revealed': '🎅 <b>The secret is out!</b>\n\nIn {title}, your Secret Santa was <b>{name}</b>. Happy holidays! 🎄',
  'events.revealedMask': '🎅 <b>The secret is out!</b>\n\nIn {title}, your Secret Santa “{mask}” was <b>{name}</b>. Happy holidays! 🎄',
  // Reminders: empty letter (with and without a deadline) and to Santas (with and without a gift exchange date)
  'events.remindAgain': 'A reminder has already been sent — you can send it again in a minute.',
  'events.remindUnfilled': '⏰ Reminder: your letter to Santa in {title} is still empty. Fill it in so your Santa can choose a gift more easily.',
  'events.remindUnfilledBy': '⏰ Reminder: your letter to Santa in {title} is still empty. Fill it in by <b>{date}</b> so your Santa can choose a gift more easily.',
  'events.remindSantas': '🎁 Reminder for Santa ({title}): is your giftee’s gift ready?\nWhen it is, mark it on the “Giftee” tab.',
  'events.remindSantasDated': '🎁 Reminder for Santa ({title}): is your giftee’s gift ready? Gift exchange: <b>{date}</b>.\nWhen it is, mark it on the “Giftee” tab.',
  // Announcements (007)
  'events.announceFinished': 'The event has finished — announcements can’t be sent in it anymore.',
  'events.announceEmpty': 'Write the announcement text.',
  'events.announcement': '📣 <b>Announcement · {title}</b>\n\n{text}',
  'events.announcementButton': '📌 Open event',
  'events.announceAgain': 'This announcement has already been sent.',
  // Settings
  'events.ringAfterDraw': 'The ring draw setting can’t be changed after the draw.',
  // Log details
  'events.auditText.fromTemplate': 'from template “{title}”',
  'events.auditText.deleted': '“{title}”, participants: {n}',
  'events.auditText.reset': 'participants removed: {n}',
  'events.auditText.invited': 'from “{title}”, invited: {n}',
  'events.auditText.pairs': 'pairs: {n}',
  'events.auditText.received': 'received: {n}',
  'events.auditText.settings': 'settings',
  'events.auditText.ring': 'ring draw: {state}',
  'events.auditText.avoidPrevious': 'avoid past pairs: {state}',
  'events.auditText.on': 'on',
  'events.auditText.off': 'off',
  'events.auditText.registrationOpen': 'open',
  'events.auditText.registrationClosed': 'closed',
};
