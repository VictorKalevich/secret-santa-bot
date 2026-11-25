// Texts of src/api.js (061, English): the check pipeline and action handlers. {owner.nom}, {owner.dat} — "the owner" or
// "the bot owner" (ownerWord); {word} — the confirmation word of the action.
export default {
  'api.badInitData': 'Couldn’t verify your sign-in. Reopen the app from the chat with the bot.',
  'api.unknownAction': 'Unknown action',
  'api.noEvent': 'Event not found.',
  'api.chooseRoom': 'Choose a room.',
  // What a finished event doesn't allow (the finished field of the actions table)
  'api.closed': 'The event has finished — it can’t be changed anymore (you can still view, reveal and delete it).',
  'api.letterClosed': 'The event has finished: the letter is now read-only.',
  'api.markClosed': 'The event has finished: the mark is read-only.',
  // Confirmation word (the confirm field): refusal without the word
  'api.confirm.delete': 'To delete, type the word {word}.',
  'api.confirm.leave': 'To leave, type the word {word}.',
  'api.confirm.cancel': 'To cancel, type the word {word}.',
  'api.confirm.reset': 'For a full reset, type the word {word}.',
  'api.confirm.vault': 'To open the service view, type the word {word}.',
  // Refusal to a non-owner (the owner field)
  'api.owner.roles': 'Only {owner.nom} can assign and remove admins.',
  'api.owner.vault': 'The service view is available only to {owner.dat}.',
  'api.owner.swap': 'Only {owner.nom} can change giftees after the draw.',
  'api.owner.transfer': 'Only {owner.nom} can transfer ownership.',
  'api.owner.insert': 'Only {owner.nom} can add people to the draw after it has happened.',
  'api.owner.fixed': 'Only {owner.nom} can set fixed pairs.',
  'api.owner.forceCancel': 'Only {owner.nom} can force-cancel the draw.',
  'api.owner.eventDelete': 'Only {owner.nom} can delete the event.',
  'api.owner.reset': 'Only {owner.nom} can do a full reset.',
  'api.botOwner.transfer': 'Only the bot owner can move participation to a new account.',
  'api.botOwner.companyDelete': 'Only the bot owner can delete a room.',
  'api.botOnly': 'Bot owner only.',
  // Handlers
  'api.nameRule': 'The name must be 1 to 40 characters',
  // 061: language choice — a code not in the bot's languages
  'api.lang.unknown': 'No such language.',
  'api.templateNotFound': 'Template not found.',
  'api.memberNotFound': 'Participant not found',
  'api.renameAdmin': 'Only {owner.nom} can rename an admin.',
  'api.renameSelfOnly': 'This person changes their name themselves: “Profile” → “✏️ Change name”.',
  'api.ownerNotTransferred': 'The owner’s record can’t be moved: the owner regains access with a new owner link (change ADMIN_SECRET → the /setup page).',
  'api.removeSelf': 'You can’t remove yourself — turn off “I’m participating”.',
  'api.removeOwner': 'The owner can’t be removed from the event. They have to transfer ownership first.',
  'api.removeAdmin': 'Only {owner.nom} can remove an admin.',
  'api.drawDone': 'The draw has already happened.',
  'api.chooseOtherEvent': 'Choose another event.',
  'api.inviteFinished': 'The event has finished — you can’t invite people to it.',
};
