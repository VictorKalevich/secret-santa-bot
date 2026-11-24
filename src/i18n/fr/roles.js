// Texts of src/roles.js (060): bot owner, admins, participation transfer. {name}, {from}, {to}, {actor} in messages -
// names (HTML)
export default {
  // App button under a message about new rights (and for a new room owner)
  'roles.openButton': "🛠 Ouvrir",
  // Bot owner rights
  'roles.botOwner.byLink': "⚠️ Les droits de propriétaire du bot sont passés à <b>{name}</b> via le lien de la page de configuration. Tu restes administrateur.\n\nSi ce n'est pas toi et que ce n'était pas convenu, change ADMIN_SECRET (voir README), ouvre la page de configuration et utilise le nouveau lien de propriétaire.",
  'roles.botOwner.transferred': "👑 <b>Tu as reçu les droits de propriétaire du bot.</b> Désormais, tu nommes et retires les administrateurs — section « Propriétaire et administrateurs » sur l'écran d'accueil de l'appli.",
  'roles.botOwner.notice': "ℹ️ <b>{name}</b> est désormais propriétaire du bot.",
  // Owner rights transfer (bot and room)
  'roles.transferTarget': "Les droits de propriétaire ne peuvent être transmis qu'à une personne inscrite.",
  'roles.alreadyOwnerSelf': "Tu es déjà propriétaire.",
  'roles.alreadyTransferred': "Les droits de propriétaire ont déjà été transmis.",
  // Admins
  'roles.alreadyAdmin': "Cette personne a déjà les droits d'administrateur.",
  'roles.notAdmin': "Cette personne n'a pas les droits d'administrateur.",
  'roles.grantUnregistered': "Seule une personne inscrite peut être nommée.",
  'roles.revokeOwner': "Impossible de retirer les droits du propriétaire. Transmets d'abord les droits de propriétaire.",
  'roles.granted': "🛠 <b>Le propriétaire t'a donné les droits d'administrateur.</b>\n\nTu peux maintenant créer des événements et les gérer : invitations, exclusions, tirage, rappels. Seul le propriétaire peut voir les paires, dans la vue de contrôle.",
  'roles.grantedNotice': "ℹ️ <b>{name}</b> est désormais administrateur.",
  'roles.revoked': "Le propriétaire t'a retiré les droits d'administrateur. En tant que participant, tu continues à jouer comme d'habitude.",
  'roles.revokedNotice': "ℹ️ <b>{name}</b> n'est plus administrateur.",
  // Participation transfer to a new account
  'roles.transfer.twoRecords': "Choisis deux comptes différents.",
  'roles.transfer.staffTarget': "Impossible de transférer une participation vers le compte du propriétaire ou d'un administrateur.",
  'roles.transfer.noOld': "Ancien compte introuvable.",
  'roles.transfer.unregistered': "Le nouveau compte doit terminer son inscription (écrire son nom au bot).",
  'roles.transfer.inDraw': "Le nouveau compte participe déjà au tirage de l'événement « {title} » — choisis un autre compte.",
  'roles.transfer.toNew': "🔁 Le propriétaire a transféré ta participation au « Père Noël secret » sur ce compte : lettres, destinataires, conversations et historique des événements sont conservés.",
  'roles.transfer.toOld': "🔁 Ta participation au « Père Noël secret » a été transférée sur le compte <b>{to}</b>. Si tu n'as pas demandé ce transfert, contacte le propriétaire.",
  'roles.transfer.notice': "🔁 <b>{actor}</b> a transféré la participation de <b>{from}</b> sur le compte <b>{to}</b>.",
  // Log: new owner; transfer "old record -> new"
  'roles.audit.newOwner': "→ {name}",
  'roles.audit.accountMoved': "{from} → {to}",
};
