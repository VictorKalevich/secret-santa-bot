// Texts of the app part 04-companies (061, English): the "Rooms" screen, the "Room" sheet, owner link, bot ownership.
// In texts for people it's always "room" (059)
export default {
  // "Rooms" screen
  'app.companies.title': 'Rooms',
  'app.companies.empty': 'No rooms yet. Create your own — or ask for an event invite link.',
  'app.companies.emptyBotOwner': 'No rooms yet.',
  'app.companies.create': '🚪 Create a room',
  'app.companies.ownLimit': 'You can run at most two rooms of your own — transfer or delete one of them.',
  'app.companies.botLog': '📜 Bot log',
  // Room row: who is the owner, how many events; buttons "✏️" and "⚙️"
  'app.companies.about': 'Owner: {owner} · events: {events}',
  'app.companies.aboutIdle': 'Owner: {owner} · events: {events} · none ongoing',
  'app.companies.roomName': 'Room name',
  'app.companies.ownName': 'Name just for you',
  'app.companies.settings': 'Room',
  // Name sheet
  'app.companies.label.field': 'Name',
  'app.companies.label.shared': 'Everyone in the room sees this name.',
  'app.companies.label.botOwner': 'Only you, the bot owner, see the room name.',
  'app.companies.label.own': 'Only you see this name.',
  'app.companies.label.saved': 'Name saved',
  // New room
  'app.companies.new.title': 'New room',
  'app.companies.new.placeholder': 'For example: Work',
  'app.companies.new.done': '🚪 Room created',
  'app.companies.new.hintOwn': 'You’ll be the room owner: you create events, invite people and assign admins. Everyone in the room will see its name.',
  'app.companies.new.hintBot': 'A room has its own people, events and admins. You can run it yourself or hand it to an owner with a link.',
  // "Room" sheet of the bot owner: who runs it
  'app.companies.lead.title': 'Who runs it',
  'app.companies.lead.you': 'You',
  'app.companies.lead.botRun': 'The room has no owner of its own: you run it.',
  'app.companies.lead.owner': 'Room owner: admins, resetting and deleting events, the service view of pairs.',
  'app.companies.lead.self': 'Run it myself',
  'app.companies.lead.selfConfirm': 'Run the room yourself? “{name}” will stay an admin.',
  'app.companies.lead.selfDone': 'You run the room again',
  // Room owner link
  'app.companies.link.title': '🔗 Room owner link',
  'app.companies.link.hint': 'The link works once: whoever opens it first becomes the room owner and can see the pairs of its events. Send it privately.',
  'app.companies.link.active': 'The link is active. It can’t be shown again — you can create a new one.',
  'app.companies.link.copy': '📋 Copy',
  'app.companies.link.shareText': '👑 Owner link for Secret Santa: open it to run your room.',
  'app.companies.link.create': 'Create link',
  'app.companies.link.renew': 'Create a new one',
  'app.companies.link.revoke': 'Revoke',
  'app.companies.link.revoked': 'Link revoked',
  // Deleting an empty room (sheet with a confirmation word)
  'app.companies.delete.section': 'Deletion',
  'app.companies.delete.hasEvents': 'The room has events — delete them first.',
  'app.companies.delete.button': '🗑 Delete room',
  'app.companies.delete.title': 'Delete room',
  'app.companies.delete.lines': ['its people and admins;', 'the room’s general log.'],
  'app.companies.delete.keepBot': 'The room has no events. Its owner and admins will get a message.',
  'app.companies.delete.keepOwn': 'The room has no events. Its admins will get a message.',
  'app.companies.delete.done': 'Room deleted',
  // Transfer bot ownership
  'app.companies.botOwner.pass': '👑 Transfer bot ownership',
  'app.companies.botOwner.title': 'Bot ownership',
  'app.companies.botOwner.hint': 'There is only one bot owner. You can transfer it to someone from the rooms you run.',
  'app.companies.botOwner.choose': 'Transfer to…',
  'app.companies.botOwner.confirm': 'Transfer bot ownership to “{name}”? They’ll create and delete rooms and assign their owners. You’ll stay an admin of your rooms.',
  'app.companies.botOwner.done': '👑 Bot ownership transferred',
};
