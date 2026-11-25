// Texts of src/bot.js (060): chat with the bot - sign-up, menu, links, replies to chats and requests, buttons. {title} -
// event title in quotes (HTML), {name} - a name (HTML, except button labels and callback answers)
export default {
  // Name prompt (047: with the Telegram name - it and buttons)
  'bot.name.prompt': "Comment t'appelles-tu ? Écris ton nom (prénom, et nom de famille si besoin) — c'est ainsi que te verront ton Père Noël, le propriétaire et les administrateurs.",
  'bot.name.offer': "Ton nom dans le jeu : <b>{name}</b>, comme sur Telegram. Ton Père Noël, le propriétaire et les administrateurs le verront. Tu en veux un autre ? Appuie sur « ✏️ Modifier le nom » ou écris-le simplement.",
  'bot.name.ask': "✏️ Écris ton nom (prénom, et nom de famille si besoin) en un seul message — 40 caractères max. C'est ainsi que te verront ton Père Noël, le propriétaire et les administrateurs.",
  'bot.name.saved': "Ton nom est déjà enregistré. Tu peux le changer dans l'appli : « Profil » → « ✏️ Modifier le nom ».",
  'bot.name.rule': "Écris ton nom en texte simple, s'il te plaît (40 caractères max).",
  'bot.name.join': "✅ Participer en tant que {name}",
  'bot.name.continue': "✅ Continuer en tant que {name}",
  'bot.name.edit': "✏️ Modifier le nom",
  // Greeting before the name prompt
  'bot.hello': "🎄 Salut ! Je suis le bot du Père Noël secret.",
  'bot.helloEvent': "🎄 Salut ! Je suis le bot du Père Noël secret : {title}.",
  'bot.niceToMeet': "Ravi de te rencontrer, {name} ! 🎉",
  'bot.createFirstEvent': "Crée ton premier événement dans l'appli — le lien d'invitation y apparaîtra.",
  'bot.writeLetterFirst': "Maintenant, ouvre l'appli et écris ta lettre à ton Père Noël secret dans l'événement {title} : ce que tu aimerais recevoir, ce que tu aimes, tes tailles, ce dont tu ne veux surtout pas.",
  'bot.closedBot': "🎄 Ce bot de Père Noël secret est privé. Pour participer, demande un lien d'invitation à un événement.",
  'bot.cancelled': "Annulé.",
  // Invitation link
  'bot.invite.stale': "Ce lien d'invitation n'est plus valable. Demandes-en un nouveau.",
  'bot.invite.removed': "Tu ne fais plus partie de l'événement {title} — impossible d'y revenir avec le lien. Si c'est une erreur, contacte le propriétaire ou un administrateur.",
  'bot.invite.closed': "Les inscriptions à l'événement {title} sont fermées. Le propriétaire ou un administrateur peut les rouvrir.",
  'bot.invite.member': "🎄 Tu participes déjà à l'événement {title}.",
  'bot.invite.joined': "🎄 Tu es dans l'événement {title} ! Ouvre l'appli et écris ta lettre à ton Père Noël secret.",
  'bot.invite.requestPending': "⏳ Ta demande de participation à l'événement {title} est déjà envoyée — en attente de réponse.",
  'bot.invite.requestSent': "⏳ Ta demande de participation à l'événement {title} est envoyée. Je t'écrirai dès qu'elle sera traitée.",
  // Bot owner link (/setup)
  'bot.ownerLink.used': "Le lien de propriétaire a déjà été utilisé. Pour en obtenir un nouveau, change ADMIN_SECRET et rouvre la page de configuration.",
  'bot.ownerLink.hello': "👑 Tu es le propriétaire du bot « Père Noël secret » : tu crées les événements et nommes les administrateurs.",
  'bot.ownerLink.done': "👑 Tu es maintenant le propriétaire du bot : événements et administrateurs sont dans l'appli.",
  // The former owner link (051) - no longer valid (063)
  'bot.ownLink.gone': "Ce lien ne fonctionne plus. Pour participer, demande un lien d'invitation à un événement.",
  // Menu
  'bot.menu.title': "🎄 <b>Père Noël secret</b>",
  // No ongoing events: can create (063) - and cannot
  'bot.menu.noEventsCreate': "Tu ne participes à aucun événement en cours. Crée ton événement dans l'appli ou demande un lien d'invitation à un événement.",
  'bot.menu.noEvents': "Tu ne participes à aucun événement en cours. Demande un lien d'invitation à un événement.",
  'bot.menu.events': "Tes événements :",
  'bot.menu.event': "• {title} — {letter}, {draw}",
  'bot.menu.letterFilled': "lettre ✅",
  'bot.menu.letterEmpty': "lettre vide ✏️",
  'bot.menu.drawAhead': "tirage à venir",
  'bot.menu.wardAssigned': "destinataire attribué 🎁",
  'bot.menu.awaitingInsert': "en attente d'ajout au tirage",
  'bot.menu.finished': "📚 Événements terminés : {n} — leur historique est dans l'appli.",
  'bot.menu.botOwner': "👑 Tu es le propriétaire du bot — événements et administrateurs sont dans l'appli.",
  'bot.menu.toWard': "💬 Au destinataire · {title}",
  'bot.menu.toSanta': "💬 Au Père Noël · {title}",
  'bot.menu.notify': "🔔 Notifications",
  // Reply to a chat and a request; {n} - message length limit
  'bot.reply.hint': "Jusqu'à {n} caractères, dans l'heure. Toute la conversation est dans l'appli (bouton « 💬 »).\n\n/cancel — annuler",
  'bot.reply.expired': "⌛ Le délai de réponse est écoulé — le message n'a pas été envoyé. Appuie à nouveau sur « ↩️ Répondre » et renvoie-le.",
  'bot.reply.tooLong': "❌ Trop long : {n} caractères, maximum {max}. Envoie plus court ou /cancel.",
  'bot.reply.failed': "❌ {error}",
  'bot.reply.toWardSent': "✅ Envoyé à ton destinataire de la part du « Père Noël secret ».",
  'bot.reply.toSantaSent': "✅ Envoyé à ton Père Noël.",
  // "Write a message" hint
  'bot.reply.toWard': "✍️ Écris un message à ton destinataire ({title}) — je le transmettrai <b>anonymement</b>, au nom du « Père Noël secret ».",
  'bot.reply.toSanta': "✍️ Écris un message à ton Père Noël ({title}) — je le transmettrai. Il sait qui tu es, mais toi, tu ne le sais pas.",
  // Requests to organizers (012)
  'bot.support.sent': "✅ Message envoyé. La réponse arrivera ici.",
  'bot.support.adminsOnly': "❌ Seuls le propriétaire et les administrateurs peuvent répondre aux questions.",
  'bot.support.answered': "✅ Envoyé au participant.",
  'bot.support.notSent': "❌ {error} Le message n'a pas été envoyé.",
  'bot.support.participant': "participant",
  'bot.support.ask': "✍️ Écris ton message sur l'événement ({title}) — je le transmettrai. Ne dis pas qui est ton destinataire.",
  'bot.support.takenAnswer': "🙋 La question est à toi",
  'bot.support.taken': "🙋 Tu prends en charge la question de <b>{name}</b> ({title}). Réponds avec le bouton ci-dessous ou dans l'appli.",
  'bot.support.someoneElse': "quelqu'un d'autre",
  'bot.support.answer': "✍️ Écris ta réponse à <b>{name}</b> (question, {title}).",
  'bot.support.answerTake': "✍️ Écris ta réponse à <b>{name}</b> (question, {title}). En répondant, tu prendras la question en charge.",
  // Join requests (008)
  'bot.request.approvedAnswer': "✅ Acceptée",
  'bot.request.rejectedAnswer': "❌ Refusée",
  'bot.request.approved': "✅ Demande acceptée : <b>{name}</b>, {title}.",
  'bot.request.rejected': "❌ Demande refusée : <b>{name}</b>, {title}.",
  // Notifications about the giftee's letter changes; bot.notify.mode.<mode>
  'bot.notify.title': "Notifications quand ton destinataire modifie sa lettre (dans tous les événements).\nActuellement : <b>{mode}</b>",
  'bot.notify.saved': "Enregistré : {mode}",
  'bot.notify.mode.sound': "🔔 Avec son",
  'bot.notify.mode.silent': "🔕 Sans son",
  'bot.notify.mode.off': "🚫 Désactivées",
  // 061: /language - language choice; name - the language name in that language
  'bot.lang.choose': "🌐 Choisis la langue du bot et de l'appli :",
  'bot.lang.auto': "Comme dans Telegram ({name})",
  'bot.lang.saved': "Langue : {name}",
};
