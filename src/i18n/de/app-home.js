// Texts of app part 03-home (061, German): the "My rounds" home screen and the "New round" sheet (063)
export default {
  // Leaving a round or tab (058): asks only about what is not saved by itself
  'app.home.unsaved': 'Wunschzettel oder Adresse sind nicht gespeichert. Ohne Speichern verlassen?',
  // Error screen of a round - back to the list
  'app.home.toEvents': 'Zu den Runden',
  // Shared labels (also on the round screen)
  'app.home.you': '  (du)',
  // Round state: labels in the list; "running" - also the "Status" row on "Info"
  'app.home.finished': 'beendet',
  'app.home.active': 'läuft',
  'app.home.notMember': 'du machst nicht mit',
  // Home screen (063): ongoing and finished events; {n} - number of finished ones
  'app.home.greet': 'Hallo, {name}!',
  'app.home.going': 'Laufend',
  'app.home.done': 'Beendet · {n}',
  'app.home.empty.create': 'Noch keine Runden. Erstelle deine eigene – Button unten – oder bitte um einen Einladungslink zu einer Runde.',
  'app.home.empty.join': 'Du machst noch bei keiner Runde mit. Bitte um einen Einladungslink zu einer Runde.',
  // The bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': 'Du bist hier als Bot-Inhaber: In den Listen der Runde tauchst du nicht auf, Nachrichten an die Admins bekommst du nicht. Deine Änderungen landen im Protokoll der Runde.',
  // New event (007: from a template; 063: the creator is the owner, limit); {year} - next year
  'app.home.create.button': '🎄 Runde erstellen',
  'app.home.create.title': 'Neue Runde',
  'app.home.create.hint': 'Jede Runde hat eigene Teilnehmer, einen Einladungslink, Wunschzettel und eine Auslosung. Du wirst ihr Inhaber und kannst Admins ernennen.',
  'app.home.create.name': 'Name der Runde',
  'app.home.create.placeholder': 'Zum Beispiel: Neujahr {year} – Familie',
  'app.home.create.noTemplate': 'Ohne Vorlage – ganz neu',
  'app.home.create.fromTemplate': 'Nach Vorlage: {title}',
  'app.home.create.invite': 'Teilnehmer der Vorlage einladen',
  'app.home.create.templateHint': 'Aus der Vorlage werden Budget, Ort, Notizen, Auslosungsregeln und Ausschlüsse übernommen. Daten nicht.',
  'app.home.create.participate': 'Ich mache auch mit',
  // Limit (063): {n} - how many more; {limit} - the limit for 12 months, {date} - when a slot frees up
  'app.home.create.left': {
    one: 'Du kannst in 12 Monaten noch {n} Runde erstellen.',
    other: 'Du kannst in 12 Monaten noch {n} Runden erstellen.',
  },
  'app.home.create.full': 'In 12 Monaten kannst du höchstens {limit} Runden erstellen. Die nächste – ab dem {date}.',
  'app.home.create.done': '🎄 Runde erstellt',
  'app.home.create.doneInvited': '🎄 Runde erstellt, Einladungen: {count}',
  'app.home.create.doneInviteError': '🎄 Runde erstellt. {error}',
};
