// Texts of src/roles.js (060): bot owner, event owner and admins (063), participation transfer. {name}, {from}, {to},
// {actor}, {who} in messages - names (HTML), {title} - event title in quotes (HTML)
export default {
  // App button under the message about new rights
  'roles.openButton': "🛠 Ouvrir",
  // Bot owner rights
  'roles.botOwner.byLink': "⚠️ Les droits de propriétaire du bot sont passés à <b>{name}</b> via le lien de la page de configuration. Tes événements restent à toi.\n\nSi ce n'est pas toi et que ce n'était pas convenu, change ADMIN_SECRET (voir README), ouvre la page de configuration et utilise le nouveau lien de propriétaire.",
  'roles.botOwner.transferred': "👑 <b>Tu as reçu les droits de propriétaire du bot.</b> Le journal du bot, tous les événements et la transmission des droits sont dans l'appli : ⚙️ « Réglages » → « Propriétaire du bot ».",
  'roles.botOwner.notice': "ℹ️ <b>{name}</b> est désormais propriétaire du bot.",
  // Transferring bot owner rights
  'roles.transferTarget': "Les droits de propriétaire ne peuvent être transmis qu'à une personne inscrite.",
  'roles.alreadyOwnerSelf': "Tu es déjà propriétaire.",
  'roles.alreadyTransferred': "Les droits de propriétaire ont déjà été transmis.",
  // Event admins
  'roles.alreadyAdmin': "Cette personne a déjà les droits d'administrateur.",
  'roles.notAdmin': "Cette personne n'a pas les droits d'administrateur.",
  'roles.grantMember': "Seul un participant de l'événement peut être nommé.",
  'roles.revokeOwner': "Impossible de retirer les droits du propriétaire. Transmets d'abord la propriété de l'événement.",
  'roles.granted': "🛠 <b>Tu as reçu les droits d'administrateur de l'événement {title}.</b>\n\nTu peux maintenant le gérer : invitations, exclusions, tirage, rappels. Seul le propriétaire de l'événement peut voir les paires, dans la vue de contrôle.",
  'roles.grantedNotice': "ℹ️ <b>{name}</b> est désormais administrateur de l'événement {title}.",
  'roles.revoked': "Tes droits d'administrateur de l'événement {title} ont été retirés. Si tu y participes, tu continues à jouer comme d'habitude.",
  'roles.revokedNotice': "ℹ️ <b>{name}</b> n'est plus administrateur de l'événement {title}.",
  // Event ownership
  'roles.owner.already': "Cette personne est déjà propriétaire.",
  'roles.owner.target': "La propriété ne peut être transmise qu'à un participant ou un administrateur de l'événement.",
  'roles.owner.alreadyPassed': "La propriété a déjà été transmise.",
  'roles.owner.toNew': "👑 <b>Tu es maintenant propriétaire de l'événement {title}.</b> Tu nommes les administrateurs, ouvres la vue de contrôle, réinitialises et supprimes l'événement — tout dans l'appli.",
  'roles.owner.toPrev': "ℹ️ La propriété de l'événement {title} est passée à <b>{who}</b>. Tu restes administrateur.",
  'roles.owner.notice': "ℹ️ Le propriétaire de l'événement {title} est désormais <b>{who}</b>.",
  // Participation transfer to a new account
  'roles.transfer.twoRecords': "Choisis deux comptes différents.",
  'roles.transfer.staffTarget': "Impossible de transférer une participation vers le compte du propriétaire ou d'un administrateur.",
  'roles.transfer.noOld': "Ancien compte introuvable.",
  'roles.transfer.unregistered': "Le nouveau compte doit terminer son inscription (écrire son nom au bot).",
  'roles.transfer.inDraw': "Le nouveau compte participe déjà au tirage de l'événement « {title} » — choisis un autre compte.",
  'roles.transfer.toNew': "🔁 Le propriétaire du bot a transféré ta participation au « Père Noël secret » sur ce compte : lettres, destinataires, conversations et historique des événements sont conservés.",
  'roles.transfer.toOld': "🔁 Ta participation au « Père Noël secret » a été transférée sur le compte <b>{to}</b>. Si tu n'as pas demandé ce transfert, contacte le propriétaire du bot.",
  'roles.transfer.notice': "🔁 <b>{actor}</b> a transféré la participation de <b>{from}</b> sur le compte <b>{to}</b>.",
  // Log: new owner; transfer "old record -> new"
  'roles.audit.newOwner': "→ {name}",
  'roles.audit.accountMoved': "{from} → {to}",
};
