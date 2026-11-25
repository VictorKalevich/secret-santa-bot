// Texts of src/membership.js (061, English): joining, join requests, "I'm participating", leaving
export default {
  'membership.memberNotFound': 'Participant not found.',
  // Log: family — name and members (records before 062), "I'm participating"
  'membership.audit.familySave': '“{name}”: {people}',
  'membership.audit.familyDelete': '“{name}”',
  'membership.audit.isParticipant': 'participating',
  'membership.audit.notParticipant': 'not participating',
  'membership.afterDraw': 'That’s not possible after the draw. Ask {owner.gen} to add you.',
  // Participant leaving (035)
  'membership.leaveAfterDraw': 'The draw has already happened. To leave, contact the owner or admins.',
  'membership.leaveFinished': 'The event has finished — you can’t leave it anymore.',
  'membership.leaveNotice': '🚪 <b>{name}</b> is leaving {title}.',
  'membership.openEventButton': '🛠 Open event',
  // Letting removed people back (010)
  'membership.notRemoved': 'This person isn’t among the removed.',
  // Joining and join requests (008)
  'membership.joinedNotice': '👋 <b>{name}</b> joins {title}',
  'membership.request': '🙋 <b>{name}</b> wants to join {title}.',
  'membership.requestWithUsername': '🙋 <b>{name}</b> (@{username}) wants to join {title}.',
  'membership.acceptButton': '✅ Approve',
  'membership.rejectButton': '❌ Decline',
  'membership.requestNotFound': 'Join request not found.',
  'membership.requestDecided': 'The join request has already been reviewed.',
  'membership.approveFinished': 'The event has finished — no one can be accepted into it anymore.',
  'membership.approveClosed': 'Registration for “{title}” is closed — open it to approve the join request.',
  // Decision on a join request: to the participant and to the other admins
  'membership.approvedAfterDraw': '🎉 Join request approved — you’re in {title}! The draw has already happened — {owner.nom} will add you, and the bot will let you know. Meanwhile, write a letter to Santa.',
  'membership.approved': '🎉 Join request approved — you’re in {title}! Open the app and write a letter to your Secret Santa.',
  'membership.requestRejected': 'Your join request for {title} was declined. If this is a mistake, contact the owner or an admin.',
  'membership.approvedBy': '✅ <b>{by}</b> approved the join request from <b>{name}</b> for {title}.',
  'membership.rejectedBy': '❌ <b>{by}</b> declined the join request from <b>{name}</b> for {title}.',
};
