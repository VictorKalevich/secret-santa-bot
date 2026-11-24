// Texts of src/stale.js (061, English): warning about auto-finishing an abandoned event (056). Reasons: date, empty, age
export default {
  // {when} — finish date, {why} — stale.why.<reason>, {keep} — stale.keep.<reason>
  'stale.warning': '⏳ <b>The event {title} will finish automatically on {when}.</b>\n{why}\n\n{keep}',
  'stale.openButton': '⚙️ Open event',
  // Why the event is considered abandoned
  'stale.why.date': 'The gift exchange date ({date}) has already passed.',
  'stale.why.empty': 'No one has joined it yet except the owner and admins.',
  'stale.why.age': 'It has no gift exchange date, and it was created more than three months ago.',
  // How to keep the event
  'stale.keep.date': 'If you still need the event, move the gift exchange date: “Manage” → “Settings”.',
  'stale.keep.empty': 'If you still need the event, invite participants or set the gift exchange date: “Manage” → “Settings”.',
  'stale.keep.age': 'If you still need the event, set the gift exchange date: “Manage” → “Settings”.',
  // Log detail of finish.warn (stale.auditText): {why} — stale.logged.<reason>
  'stale.auditText': '{why}; finishes on {when}',
  'stale.logged.date': 'gift exchange date has passed',
  'stale.logged.empty': 'no one joined except the owner and admins',
  'stale.logged.age': 'no gift exchange date',
};
