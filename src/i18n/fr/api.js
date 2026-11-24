// Texts of src/api.js (060): check pipeline and action handlers. {owner.nom}, {owner.dat} - "the owner" or "the bot
// owner" (ownerWord) in the needed form; {word} - the confirmation word of the action.
export default {
  'api.badInitData': "Impossible de vérifier la connexion. Rouvre l'appli depuis la discussion avec le bot.",
  'api.unknownAction': "Action inconnue",
  'api.noEvent': "Événement introuvable.",
  'api.chooseRoom': "Choisis un salon.",
  // What is not allowed in a finished event (field finished of the action table)
  'api.closed': "L'événement est terminé — il ne peut plus être modifié (consultation, révélation et suppression restent possibles).",
  'api.letterClosed': "L'événement est terminé : la lettre est désormais en lecture seule.",
  'api.markClosed': "L'événement est terminé : la case est en lecture seule.",
  'api.maskClosed': "L'événement est terminé : le masque ne peut plus être changé.",
  // Confirmation word (field confirm): refusal without the word
  'api.confirm.delete': "Pour supprimer, saisis le mot {word}.",
  'api.confirm.leave': "Pour quitter, saisis le mot {word}.",
  'api.confirm.cancel': "Pour annuler, saisis le mot {word}.",
  'api.confirm.reset': "Pour tout réinitialiser, saisis le mot {word}.",
  'api.confirm.vault': "Pour la vue de contrôle, saisis le mot {word}.",
  // Refusal to a non-owner (field owner)
  'api.owner.roles': "Seul {owner.nom} peut nommer et retirer des administrateurs.",
  'api.owner.vault': "La vue de contrôle est réservée {owner.dat}.",
  'api.owner.swap': "Seul {owner.nom} peut échanger des destinataires après le tirage.",
  'api.owner.transfer': "Seul {owner.nom} peut transmettre les droits de propriétaire.",
  'api.owner.insert': "Seul {owner.nom} peut ajouter quelqu'un au tirage après celui-ci.",
  'api.owner.fixed': "Seul {owner.nom} peut imposer des paires.",
  'api.owner.forceCancel': "Seul {owner.nom} peut forcer l'annulation du tirage.",
  'api.owner.eventDelete': "Seul {owner.nom} peut supprimer l'événement.",
  'api.owner.reset': "Seul {owner.nom} peut tout réinitialiser.",
  'api.botOwner.transfer': "Seul le propriétaire du bot peut transférer une participation vers un nouveau compte.",
  'api.botOwner.companyDelete': "Seul le propriétaire du bot peut supprimer un salon.",
  'api.botOnly': "Réservé au propriétaire du bot.",
  // Handlers
  'api.nameRule': "Le nom doit compter de 1 à 40 caractères",
  // 061: language choice - code not in the bot's language list
  'api.lang.unknown': "Cette langue n'existe pas.",
  'api.templateNotFound': "Modèle introuvable.",
  'api.memberNotFound': "Participant introuvable",
  'api.renameAdmin': "Seul {owner.nom} peut renommer un administrateur.",
  'api.renameSelfOnly': "Cette personne change son nom elle-même : « Profil » → « ✏️ Modifier le nom ».",
  'api.ownerNotTransferred': "Le compte du propriétaire ne se transfère pas : il récupère l'accès avec un nouveau lien de propriétaire (changer ADMIN_SECRET → page /setup).",
  'api.removeSelf': "Tu ne peux pas te retirer toi-même — désactive « Je participe ».",
  'api.removeOwner': "Le propriétaire ne peut pas être retiré de l'événement. Il doit d'abord transmettre ses droits de propriétaire.",
  'api.removeAdmin': "Seul {owner.nom} peut retirer un administrateur.",
  'api.drawDone': "Le tirage au sort a déjà eu lieu.",
  'api.chooseOtherEvent': "Choisis un autre événement.",
  'api.inviteFinished': "L'événement est terminé — impossible d'y inviter.",
};
