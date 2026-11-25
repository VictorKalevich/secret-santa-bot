// Texts of app part 03-home (060): the "My events" home screen and the "New event" sheet (063)
export default {
  // Leaving an event or tab (058): asks only about what will not be saved by itself
  'app.home.unsaved': 'La letterina non è salvata. Uscire senza salvare?',
  // Error screen on an event - back to the list
  'app.home.toEvents': "Torna agli eventi",
  // Common labels (also on the event screen)
  'app.home.you': "  (tu)",
  // Event state: labels in the list; "running" - also the "Status" row on "Info"
  'app.home.finished': "concluso",
  'app.home.active': "in corso",
  'app.home.notMember': "non partecipi",
  // Home screen (063): running and finished events; {n} - number of finished ones
  'app.home.greet': "Ciao, {name}!",
  'app.home.going': "In corso",
  'app.home.done': "Conclusi · {n}",
  'app.home.empty.create': "Non ci sono ancora eventi. Creane uno tuo (il pulsante è in basso) oppure chiedi il link d'invito a un evento.",
  'app.home.empty.join': "Non partecipi ancora a nessun evento. Chiedi il link d'invito a un evento.",
  // Bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': "Sei qui come proprietario del bot: non compari negli elenchi dell'evento e non ricevi i messaggi per gli amministratori. Le tue modifiche finiscono nel registro dell'evento.",
  // New event (007: from a template; 063: the creator is the owner, limit); {year} is the next year
  'app.home.create.button': "🎄 Crea evento",
  'app.home.create.title': "Nuovo evento",
  'app.home.create.hint': "Scrivi il nome dell'evento",
  'app.home.create.name': "Nome dell'evento",
  'app.home.create.placeholder': 'Capodanno {year} — famiglia',
  'app.home.create.noTemplate': "Senza modello: da zero",
  'app.home.create.fromTemplate': "Dal modello: {title}",
  'app.home.create.invite': "Invita i partecipanti del modello",
  'app.home.create.templateHint': "Dal modello si copiano budget, luogo, note, regole del sorteggio ed esclusioni. Le date no.",
  'app.home.create.participate': "Partecipo anch'io",
  // Limit (063): {n} - how many more are allowed; {limit} - the limit per 12 months, {date} - when a slot frees up
  'app.home.create.left': {
    one: "Puoi creare ancora {n} evento in 12 mesi.",
    other: "Puoi creare ancora {n} eventi in 12 mesi.",
  },
  'app.home.create.full': "In 12 mesi puoi creare al massimo {limit} eventi. Il prossimo potrai crearlo dal {date}.",
  'app.home.create.done': "🎄 Evento creato",
  'app.home.create.doneInvited': "🎄 Evento creato, inviti: {count}",
  'app.home.create.doneInviteError': "🎄 Evento creato. {error}",
};
