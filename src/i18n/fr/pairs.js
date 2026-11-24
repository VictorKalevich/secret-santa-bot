// Texts of src/pairs.js (060): draw, insertion, removal, cancellation, giftee swap
export default {
  // Why the draw is impossible (pairs.reason.<problem type of draw.js>); {name} - participant name
  'pairs.reason.too_few': "Il faut au moins 2 participants.",
  'pairs.reason.ring_too_few': "Le tirage en cercle demande au moins 3 participants — ou désactive le tirage en cercle dans les paramètres.",
  'pairs.reason.ring_impossible': "Avec ces exclusions, impossible apparemment d'éviter les paires réciproques. Réessaie ; si ça ne marche pas, retire quelques exclusions ou désactive le tirage en cercle.",
  'pairs.reason.no_receivers': "{name} ne peut offrir à personne — vérifie les exclusions.",
  'pairs.reason.no_givers': "Personne ne peut offrir à {name} — vérifie les exclusions.",
  'pairs.reason.search_exhausted': "Impossible de trouver rapidement une répartition — réessaie. Si ça ne marche pas, retire quelques exclusions ou désactive le tirage en cercle.",
  'pairs.reason.fixed_block': "Les paires imposées bloquent : avec elles, impossible de répartir tout le monde selon les règles. {owner.nomCap} peut retirer certaines paires imposées.",
  'pairs.reason.too_strict': "Trop d'exclusions : impossible de répartir tout le monde en les respectant. Retire quelques exclusions.",
  // Participant without a name in the reason
  'pairs.familiesBlock': "Les familles bloquent : les membres d'une même famille ne s'offrent rien, et la répartition est impossible ainsi. Désactive « Tenir compte des familles » ou le tirage en cercle.",
  // Draw
  'pairs.drawn': "🎄 <b>Le tirage au sort de l'événement {title} a eu lieu !</b>\n\nOuvre l'appli et va dans l'onglet « Destinataire » pour découvrir à qui tu offres un cadeau. Ne le dis à personne 🤫",
  'pairs.drawnButton': "🎁 Découvrir mon destinataire",
  'pairs.drawFinished': "L'événement est terminé.",
  'pairs.drawRace': "Les participants, les exclusions ou les familles ont changé pendant le tirage — réessaie.",
  'pairs.notDrawn': "Le tirage n'a pas eu lieu.",
  // Pairs after a change of members: to the new participant and to a Santa with a new giftee
  'pairs.inserted': "🎄 <b>Tu es dans le jeu !</b> Le tirage de l'événement {title} est fait pour toi — va voir l'onglet « Destinataire » 🤫",
  'pairs.newWard': "🔄 Les participants de l'événement {title} ont changé, et tu as maintenant <b>un nouveau destinataire</b>. Va voir l'onglet « Destinataire ».",
  'pairs.lookButton': "🎁 Voir",
  // Removing and inserting a participant
  'pairs.notMember': "Cette personne ne participe pas à cet événement.",
  'pairs.removeBlocked': "Impossible de retirer ce participant sans enfreindre les exclusions ou le tirage en cercle. Assouplis les exclusions.",
  'pairs.removed': "Tu ne fais plus partie de l'événement {title}. Si c'est une erreur, contacte le propriétaire ou un administrateur.",
  'pairs.alreadyInDraw': "Ce participant est déjà dans le tirage.",
  'pairs.insertBlocked': "Impossible d'ajouter ce participant sans enfreindre les règles : tous ceux dont le destinataire pourrait changer ont déjà un cadeau prêt, ou les exclusions bloquent. Tu peux annuler le tirage dans la zone de danger et le relancer.",
  // Giftee swap (048): rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': "L'un des deux offre à l'autre : après l'échange, quelqu'un s'offrirait un cadeau à lui-même.",
  'pairs.swapRule.exclusion': "Exclusions : l'un des deux offrirait à quelqu'un à qui il ne doit pas offrir.",
  'pairs.swapRule.family': "Familles : l'un des deux offrirait à un membre de sa famille.",
  'pairs.swapRule.ring': "Tirage en cercle : une paire réciproque apparaîtrait — deux personnes s'offriraient mutuellement.",
  'pairs.swapRule.fixed': "Paires imposées : l'échange casserait une paire que tu as imposée.",
  'pairs.swapRule.history': "Paires passées : l'un des deux offrirait à la même personne que lors de l'événement précédent.",
  'pairs.swapRevealed': "Le secret est déjà révélé — impossible d'échanger les destinataires.",
  'pairs.swapTwo': "Choisis deux participants différents.",
  'pairs.notInDraw': "Ce participant n'est pas dans le tirage.",
  'pairs.swapStale': "Les paires ont déjà changé — rouvre l'échange.",
  'pairs.swapSelf': "Impossible d'échanger ces deux-là — choisis une autre paire.",
  'pairs.swapRulesChanged': "Les règles du tirage pour cet échange ont changé — vérifie à nouveau.",
  'pairs.swapNotice': "🔄 Le propriétaire a modifié le tirage de l'événement {title} : tu as maintenant <b>un nouveau destinataire</b>. L'ancienne paire n'est plus valable et sa conversation est supprimée. Va voir l'onglet « Destinataire ».",
  // Draw cancellation (007) and forced cancellation (012)
  'pairs.cancelFinished': "L'événement est terminé — impossible d'annuler le tirage.",
  'pairs.cancelRevealed': "Le secret est déjà révélé — impossible d'annuler le tirage.",
  'pairs.cancelBlocked': "Annulation impossible : quelqu'un a déjà découvert son destinataire ou une conversation a commencé.",
  'pairs.cancelled': "↩️ <b>Le tirage a été annulé</b> dans l'événement {title}. Ta lettre au Père Noël est conservée. Le bot te préviendra du prochain tirage.",
  'pairs.forceCancelled': "↩️ Le propriétaire a <b>annulé le tirage</b> dans l'événement {title}. L'ancienne paire n'est plus valable, les conversations avec ton Père Noël et ton destinataire sont supprimées. Ta lettre est conservée. Le bot te préviendra du prochain tirage.",
  // Log details
  'pairs.auditText.members': "participants : {n}",
  'pairs.auditText.changed': "paires modifiées : {n}",
  'pairs.auditText.removed': "paires supprimées : {n}",
};
