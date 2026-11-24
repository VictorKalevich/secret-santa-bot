// Texts of src/roles.js (061, English): bot owner, admins, moving participation. {name}, {from}, {to}, {actor} in
// messages — names (HTML)
export default {
  // App button under a message about new rights (also for a new room owner)
  'roles.openButton': '🛠 Open',
  // Bot ownership
  'roles.botOwner.byLink': '⚠️ Bot ownership has passed to <b>{name}</b> via the link from the setup page. You stay an admin.\n\nIf that wasn’t you or wasn’t agreed — change ADMIN_SECRET (see README), open the setup page and follow the new owner link.',
  'roles.botOwner.transferred': '👑 <b>You’ve been given bot ownership.</b> Now you assign and remove admins — see “Owner and admins” on the home screen of the app.',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> is now the bot owner.',
  // Transferring ownership (of the bot and of a room)
  'roles.transferTarget': 'Ownership can only be transferred to a registered person.',
  'roles.alreadyOwnerSelf': 'You’re already the owner.',
  'roles.alreadyTransferred': 'Ownership has already been transferred.',
  // Admins
  'roles.alreadyAdmin': 'They’re already an admin.',
  'roles.notAdmin': 'They’re not an admin.',
  'roles.grantUnregistered': 'Only a registered person can be made an admin.',
  'roles.revokeOwner': 'You can’t remove the owner’s rights. Transfer ownership first.',
  'roles.granted': '🛠 <b>The owner has made you an admin.</b>\n\nNow you can create events and run them: invitations, exclusions, the draw, reminders. Only the owner can see the pairs, in the service view.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> is now an admin.',
  'roles.revoked': 'The owner has removed your admin rights. As a participant, you keep playing as usual.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> is no longer an admin.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Choose two different records.',
  'roles.transfer.staffTarget': 'Participation can’t be moved to the account of the owner or an admin.',
  'roles.transfer.noOld': 'Old record not found.',
  'roles.transfer.unregistered': 'The new account has to finish signing up (send the bot a name).',
  'roles.transfer.inDraw': 'The new account is already in the draw of “{title}” — choose another record.',
  'roles.transfer.toNew': '🔁 The owner has moved your Secret Santa participation to this account: letters, giftees, chats and event history are kept.',
  'roles.transfer.toOld': '🔁 Your Secret Santa participation has been moved to the account <b>{to}</b>. If you didn’t ask for this, contact the owner.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> moved the participation of <b>{from}</b> to the account <b>{to}</b>.',
  // Log: new owner; move "old record → new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
