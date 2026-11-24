// Texts of src/companies.js (061, English): rooms — creation, names, room owner, owner link, deletion
export default {
  // Refusals
  'companies.ownLimit': 'You can run at most two rooms of your own — transfer or delete one of them.',
  'companies.recent': 'A room with this name was just created.',
  'companies.nameRule': 'The room name must be 1 to 40 characters.',
  'companies.labelRule': 'The name must be up to 40 characters.',
  'companies.hasEvents': 'The room has events — delete them first.',
  'companies.ownDelete': 'Only the room’s owner can delete it.',
  'companies.alreadyOwner': 'They’re already the owner.',
  // Room owner link (bot: /start own_<code>)
  'companies.ownerLinkGone': 'This owner link has already been used or revoked. Ask for a new one.',
  'companies.newOwner': '👑 You’re the owner of your own room in Secret Santa: you create events, invite people and assign admins.',
  // Room without its own or a shared name — its number among the person's rooms
  'companies.numbered': 'Room {n}',
  // Room owner change: {who}, {by} — names (HTML), {title} — room name in quotes
  'companies.owner.transferred': '👑 <b>You’ve been given ownership of the room.</b> Now you assign and remove admins, reset and delete events, and open the service view — all in the app.',
  'companies.owner.returned': '👑 <b>{by}</b> handed the room {title} to you: you run it again.',
  'companies.owner.prevNext': 'ℹ️ <b>{who}</b> now has ownership of the room. You stay an admin.',
  'companies.owner.prevBot': 'ℹ️ The bot owner runs the room again. You stay an admin.',
  'companies.owner.byLink': '👑 <b>{who}</b> is now the owner of the room {title}.',
  'companies.owner.byLinkUsername': '👑 <b>{who}</b> (@{username}) is now the owner of the room {title}.',
  'companies.owner.passed': 'ℹ️ <b>{by}</b> transferred ownership of the room {title}: the owner is now <b>{who}</b>.',
  'companies.owner.notice': 'ℹ️ <b>{who}</b> is now the owner.',
  // Deleting an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': 'The owner deleted a room where you were an admin: it had no events.',
  'companies.deleted.yours': 'The bot owner deleted a room you ran: it had no events.',
  'companies.deleted.admin': 'The bot owner deleted a room where you were an admin: it had no events.',
  // Log: {title} — room name
  'companies.audit.byLink': 'via link: {name}',
  'companies.audit.toBotOwner': '→ bot owner',
  'companies.audit.ownerChanged': '“{title}”: {details}',
  'companies.audit.linkRevoked': '“{title}”: revoked',
  'companies.audit.linkCreated': '“{title}”: created',
  'companies.audit.roomDeleted': '“{title}”, people: {n}',
};
