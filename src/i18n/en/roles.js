// Texts of src/roles.js (061, English): bot owner, event owner and admins (063), moving participation. {name}, {from},
// {to}, {actor}, {who} in messages — names (HTML), {title} — event name in quotes (HTML)
export default {
  // App button under the message about new rights
  'roles.openButton': '🛠 Open',
  // Bot ownership
  'roles.botOwner.byLink': '⚠️ Bot ownership has passed to <b>{name}</b> via the link from the setup page. Your events stay yours.\n\nIf that wasn’t you or wasn’t agreed — change ADMIN_SECRET (see README), open the setup page and follow the new owner link.',
  'roles.botOwner.transferred': '👑 <b>You’ve been given bot ownership.</b> The bot log, all events and transferring ownership are in the app: ⚙️ “Settings” → “Bot owner”.',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> is now the bot owner.',
  // Transferring bot owner rights
  'roles.transferTarget': 'Ownership can only be transferred to a registered person.',
  'roles.alreadyOwnerSelf': 'You’re already the owner.',
  'roles.alreadyTransferred': 'Ownership has already been transferred.',
  // Event admins
  'roles.alreadyAdmin': 'They’re already an admin.',
  'roles.notAdmin': 'They’re not an admin.',
  'roles.grantMember': 'Only a participant of the event can be made an admin.',
  'roles.revokeOwner': 'You can’t remove the owner’s rights. Transfer event ownership first.',
  'roles.granted': '🛠 <b>You’ve been made an admin of {title}.</b>\n\nNow you can run it: invitations, exclusions, the draw, reminders. Only the event owner can see the pairs, in the service view.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> is now an admin of {title}.',
  'roles.revoked': 'Your admin rights for {title} have been removed. If you’re participating in it, you keep playing as usual.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> is no longer an admin of {title}.',
  // Event ownership
  'roles.owner.already': 'They’re already the owner.',
  'roles.owner.target': 'Ownership can only be transferred to a participant or admin of the event.',
  'roles.owner.alreadyPassed': 'Ownership has already been transferred.',
  'roles.owner.toNew': '👑 <b>You’re now the owner of {title}.</b> You assign admins, open the service view, reset and delete the event — all in the app.',
  'roles.owner.toPrev': 'ℹ️ Ownership of {title} has passed to <b>{who}</b>. You stay an admin.',
  'roles.owner.notice': 'ℹ️ The owner of {title} is now <b>{who}</b>.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Choose two different records.',
  'roles.transfer.staffTarget': 'Participation can’t be moved to the account of the owner or an admin.',
  'roles.transfer.noOld': 'Old record not found.',
  'roles.transfer.unregistered': 'The new account has to finish signing up (send the bot a name).',
  'roles.transfer.inDraw': 'The new account is already in the draw of “{title}” — choose another record.',
  'roles.transfer.toNew': '🔁 The bot owner has moved your Secret Santa participation to this account: letters, giftees, chats and event history are kept.',
  'roles.transfer.toOld': '🔁 Your Secret Santa participation has been moved to the account <b>{to}</b>. If you didn’t ask for this, contact the bot owner.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> moved the participation of <b>{from}</b> to the account <b>{to}</b>.',
  // Log: new owner; move "old record → new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
