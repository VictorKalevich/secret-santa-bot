// Texts of the app part 03-home (061, English): home screen, "Profile", "Notifications", owner and admins
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
  // Home screen
  'app.home.greet': 'Hi, {name}!',
  'app.home.guest': 'You’re here as the bot owner: you aren’t on the room’s lists, and messages to its admins don’t reach you. Your changes are recorded in the room’s log.',
  'app.home.myEvents': 'My events',
  'app.home.noEvents.admin': 'You’re not in any event yet. Create an event or join an existing one (“Manage” → “I’m participating”).',
  'app.home.noEvents.member': 'You’re not in any event yet. Ask for an event invite link.',
  'app.home.otherEvents': 'Other events',
  // New event (007: from a template); {year} — next year
  'app.home.create.button': '🎄 Create',
  'app.home.create.title': 'New event',
  'app.home.create.hint': 'The event will have its own participants, invite link, letters and draw. You can run several events at once.',
  'app.home.create.name': 'Event name',
  'app.home.create.placeholder': 'For example: New Year {year} — family',
  'app.home.create.noTemplate': 'No template — start from scratch',
  'app.home.create.fromTemplate': 'From template: {title}',
  'app.home.create.invite': 'Invite the template’s participants',
  'app.home.create.templateHint': 'Copied from the template: budget, place, notes, draw rules and exclusions. Dates are not copied.',
  'app.home.create.done': '🎄 Event created',
  'app.home.create.doneInvited': '🎄 Event created, invitations: {count}',
  'app.home.create.doneInviteError': '🎄 Event created. {error}',
  // "Profile" and "Notifications"
  'app.home.profile.title': 'Profile',
  'app.home.profile.editName': '✏️ Change name',
  // 061: language of the bot and the app; name — the language name in that language
  'app.home.lang.button': '🌐 Language',
  'app.home.lang.auto': 'Same as Telegram ({name})',
  'app.home.lang.hint': 'The bot and the app will use this language. “Same as Telegram” is the language of your Telegram.',
  'app.home.notify.title': 'Notifications',
  'app.home.notify.sound': '🔔 Sound',
  'app.home.notify.silent': '🔕 Silent',
  'app.home.notify.off': '🚫 Off',
  // "Your name" sheet (035): title and field label
  'app.home.name.title': 'Your name',
  'app.home.name.hint': 'One name for all events. The owner, admins and your Santa see it — and so does your giftee after the reveal.',
  'app.home.name.empty': 'Enter your name',
  'app.home.name.saved': 'Name saved',
  // Owner and admins (002, 051)
  'app.home.admins.title': 'Owner and admins',
  'app.home.admins.makeOwnerConfirm': 'Make “{name}” the owner of this room? They’ll be able to do all the owner can: admins, resetting and deleting events, the service view of pairs. You stay the bot owner and can take the room back.',
  'app.home.admins.transferConfirm': 'Transfer ownership to “{name}”? You’ll stay an admin, but only the new owner will be able to assign and remove admins.',
  'app.home.admins.transferred': '👑 Ownership transferred',
  'app.home.admins.transfer': 'Transfer ownership',
  'app.home.admins.revoke': 'Remove admin rights',
  'app.home.admins.revokeConfirm': 'Remove admin rights from “{name}”?',
  'app.home.admins.revoked': 'Admin rights removed',
  'app.home.admins.grantPick': 'Who to make an admin…',
  'app.home.admins.grant': '🛠 Make admin',
  'app.home.admins.grantConfirm': 'Make “{name}” an admin? They’ll be able to create and run events. Only the owner can see the pairs, in the service view.',
  'app.home.admins.granted': 'Admin assigned',
  'app.home.admins.ownerHint': 'Admins create and run events. Only you can assign and remove admins and transfer ownership (👑).',
  'app.home.admins.ownerPick': 'Who to make the owner…',
  'app.home.admins.makeOwner': '👑 Make owner',
  'app.home.admins.onlyOwner': 'Only the owner can assign and remove admins.',
  'app.home.admins.onlyOwnerNamed': 'Only the owner — {name} — can assign and remove admins.',
  'app.home.admins.logHint': 'Roles, moved participation, deleted events — who did what and when.',
};
