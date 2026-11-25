// Texts of src/membership.js (060): joining, join requests, "I take part", leaving
export default {
  'membership.memberNotFound': "Participant introuvable.",
  // Log: family - name and members (records before 062), "I take part"
  'membership.audit.familySave': "« {name} » : {people}",
  'membership.audit.familyDelete': "« {name} »",
  'membership.audit.isParticipant': "participe",
  'membership.audit.notParticipant': "ne participe pas",
  'membership.afterDraw': "Ce n'est plus possible après le tirage. Demande {owner.dat} de t'ajouter.",
  // Leaving (035)
  'membership.leaveAfterDraw': "Le tirage a déjà eu lieu. Pour quitter l'événement, adresse-toi au propriétaire ou aux administrateurs.",
  'membership.leaveFinished': "L'événement est terminé — tu ne peux plus le quitter.",
  'membership.leaveNotice': "🚪 <b>{name}</b> quitte l'événement {title}.",
  'membership.openEventButton': "🛠 Ouvrir l'événement",
  // Return of removed people (010)
  'membership.notRemoved': "Cette personne ne fait pas partie des participants retirés.",
  // Joining and join requests (008)
  'membership.joinedNotice': "👋 <b>{name}</b> rejoint l'événement {title}",
  'membership.request': "🙋 <b>{name}</b> veut participer à l'événement {title}.",
  'membership.requestWithUsername': "🙋 <b>{name}</b> (@{username}) veut participer à l'événement {title}.",
  'membership.acceptButton': "✅ Accepter",
  'membership.rejectButton': "❌ Refuser",
  'membership.requestNotFound': "Demande introuvable.",
  'membership.requestDecided': "Cette demande a déjà été traitée.",
  'membership.approveFinished': "L'événement est terminé — impossible d'y accepter quelqu'un.",
  'membership.approveClosed': "Les inscriptions à l'événement « {title} » sont fermées — ouvre-les pour accepter la demande.",
  // Decision on a request: to the participant and to the other admins
  'membership.approvedAfterDraw': "🎉 Demande acceptée — tu es dans l'événement {title} ! Le tirage a déjà eu lieu : {owner.nom} t'ajoutera et le bot te préviendra. En attendant, écris ta lettre au Père Noël.",
  'membership.approved': "🎉 Demande acceptée — tu es dans l'événement {title} ! Ouvre l'appli et écris ta lettre à ton Père Noël secret.",
  'membership.requestRejected': "Ta demande de participation à l'événement {title} a été refusée. Si c'est une erreur, contacte le propriétaire ou un administrateur.",
  'membership.approvedBy': "✅ <b>{by}</b> a accepté la demande de <b>{name}</b> pour l'événement {title}.",
  'membership.rejectedBy': "❌ <b>{by}</b> a refusé la demande de <b>{name}</b> pour l'événement {title}.",
};
