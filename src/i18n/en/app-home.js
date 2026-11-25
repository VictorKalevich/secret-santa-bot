// Texts of the app part 03-home (061, English): the "My events" home screen and the "New event" sheet (063)
export default {
  // Leaving an event or a tab (058): asks only about what won't be saved by itself
  'app.home.unsaved': 'Your letter or address isn’t saved. Leave without saving?',
  // Error screen of an event — back to the list
  'app.home.toEvents': 'Back to events',
  // Shared labels (also on the event screen)
  'app.home.you': '  (you)',
  // Event state: labels in the list
  'app.home.finished': 'finished',
  'app.home.active': 'ongoing',
  'app.home.notMember': 'you’re not participating',
  // Home screen (063): ongoing and finished events; {n} — number of finished ones
  'app.home.greet': 'Hi, {name}!',
  'app.home.going': 'Ongoing',
  'app.home.done': 'Finished · {n}',
  'app.home.empty.create': 'No events yet. Create your own — the button below — or ask for an event invite link.',
  'app.home.empty.join': 'You’re not in any event yet. Ask for an event invite link.',
  // The bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': 'You’re here as the bot owner: you aren’t on the event’s lists, and messages to admins don’t reach you. Your changes are recorded in the event log.',
  // New event (007: from a template; 063: the creator is the owner, limit); {year} — next year
  'app.home.create.button': '🎄 Create event',
  'app.home.create.title': 'New event',
  'app.home.create.hint': 'The event will have its own participants, invite link, letters and draw. You’ll be its owner and can assign admins.',
  'app.home.create.name': 'Event name',
  'app.home.create.placeholder': 'For example: New Year {year} — family',
  'app.home.create.noTemplate': 'No template — start from scratch',
  'app.home.create.fromTemplate': 'From template: {title}',
  'app.home.create.invite': 'Invite the template’s participants',
  'app.home.create.templateHint': 'Copied from the template: budget, place, notes, draw rules and exclusions. Dates are not copied.',
  'app.home.create.participate': 'I’m participating too',
  // Limit (063): {n} — how many more; {limit} — the limit for 12 months, {date} — when a slot frees up
  'app.home.create.left': {
    one: 'You can create {n} more event in 12 months.',
    other: 'You can create {n} more events in 12 months.',
  },
  'app.home.create.full': 'You can create up to {limit} events in 12 months. The next one will be available on {date}.',
  'app.home.create.done': '🎄 Event created',
  'app.home.create.doneInvited': '🎄 Event created, invitations: {count}',
  'app.home.create.doneInviteError': '🎄 Event created. {error}',
};
