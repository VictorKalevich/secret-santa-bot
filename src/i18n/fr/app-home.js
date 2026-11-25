// Texts of app part 03-home (060): the "My events" home screen and the "New event" sheet (063)
export default {
  // Leaving an event or tab (058): asks only about what will not be saved by itself
  'app.home.unsaved': "La lettre n'est pas enregistrée. Partir sans enregistrer ?",
  // Error screen on an event - back to the list
  'app.home.toEvents': "Retour aux événements",
  // Common labels (also on the event screen)
  'app.home.you': "  (toi)",
  // Event state: labels in the list; "running" - also the "Status" row on "Info"
  'app.home.finished': "terminé",
  'app.home.active': "en cours",
  'app.home.notMember': "tu ne participes pas",
  // Home screen (063): ongoing and finished events; {n} - number of finished ones
  'app.home.greet': "Salut, {name} !",
  'app.home.going': "En cours",
  'app.home.done': "Terminés · {n}",
  'app.home.empty.create': "Pas encore d'événements. Crée le tien — bouton en bas — ou demande un lien d'invitation à un événement.",
  'app.home.empty.join': "Tu ne participes encore à aucun événement. Demande un lien d'invitation à un événement.",
  // The bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': "Tu es ici en tant que propriétaire du bot : tu n'apparais pas dans les listes de l'événement et ne reçois pas les messages destinés aux administrateurs. Tes modifications sont inscrites dans le journal de l'événement.",
  // New event (007: from a template; 063: the creator is the owner, limit); {year} - next year
  'app.home.create.button': "🎄 Créer un événement",
  'app.home.create.title': "Nouvel événement",
  'app.home.create.hint': "Écris le nom de l'événement",
  'app.home.create.name': "Nom de l'événement",
  'app.home.create.placeholder': 'Nouvel An {year} — en famille',
  'app.home.create.noTemplate': "Sans modèle — partir de zéro",
  'app.home.create.fromTemplate': "Sur le modèle : {title}",
  'app.home.create.invite': "Inviter les participants du modèle",
  'app.home.create.templateHint': "Le budget, le lieu, les notes, les règles du tirage et les exclusions sont copiés depuis le modèle. Les dates, non.",
  'app.home.create.participate': "Je participe aussi",
  // Limit (063): {n} - how many more; {limit} - the limit for 12 months, {date} - when a slot frees up
  'app.home.create.left': {
    one: "Tu peux encore créer {n} événement en 12 mois.",
    other: "Tu peux encore créer {n} événements en 12 mois.",
  },
  'app.home.create.full': "En 12 mois, tu peux créer au plus {limit} événements. Le prochain — à partir du {date}.",
  'app.home.create.done': "🎄 Événement créé",
  'app.home.create.doneInvited': "🎄 Événement créé, invitations : {count}",
  'app.home.create.doneInviteError': "🎄 Événement créé. {error}",
};
