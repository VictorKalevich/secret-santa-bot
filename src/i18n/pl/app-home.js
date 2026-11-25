// Texts of app part 03-home (060): the "My events" home screen and the "New event" sheet (063)
export default {
  // Leaving an event or a tab (058): asks only about what will not save by itself
  'app.home.unsaved': 'List nie został zapisany. Wyjść bez zapisywania?',
  'app.home.toEvents': 'Do listy wydarzeń',
  'app.home.you': '  (ty)',
  // Event state: labels in the list; "active" — also the "Status" row on "Info"
  'app.home.finished': 'zakończone',
  'app.home.active': 'trwa',
  'app.home.notMember': 'nie uczestniczysz',
  // Home screen (063): running and finished events; {n} - number of finished ones
  'app.home.greet': 'Cześć, {name}!',
  'app.home.going': 'Trwają',
  'app.home.done': 'Zakończone · {n}',
  'app.home.empty.create': 'Nie ma jeszcze wydarzeń. Utwórz własne — przycisk na dole — albo poproś o link z zaproszeniem do wydarzenia.',
  'app.home.empty.join': 'Nie uczestniczysz jeszcze w żadnym wydarzeniu. Poproś o link z zaproszeniem do wydarzenia.',
  // Bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': 'Jesteś tu jako właściciel bota: nie ma Cię na listach wydarzenia, a wiadomości dla administratorów do Ciebie nie trafiają. Twoje zmiany są zapisywane w dzienniku wydarzenia.',
  // New event (007: from a template; 063: the creator is the owner, limit); {year} is the next year
  'app.home.create.button': '🎄 Utwórz wydarzenie',
  'app.home.create.title': 'Nowe wydarzenie',
  'app.home.create.hint': 'Wpisz nazwę wydarzenia',
  'app.home.create.name': 'Nazwa wydarzenia',
  'app.home.create.placeholder': 'Nowy Rok {year} — rodzina',
  'app.home.create.noTemplate': 'Bez wzoru — od zera',
  'app.home.create.fromTemplate': 'Na wzór: {title}',
  'app.home.create.invite': 'Zaproś uczestników wzoru',
  'app.home.create.templateHint': 'Ze wzoru kopiowane są budżet, miejsce, notatki, reguły losowania i wykluczenia. Daty — nie.',
  'app.home.create.participate': 'Też biorę udział',
  // Limit (063): {n} - how many more are allowed; {limit} - the limit per 12 months, {date} - when a slot frees up
  'app.home.create.left': {
    one: 'W ciągu 12 miesięcy możesz utworzyć jeszcze {n} wydarzenie.',
    few: 'W ciągu 12 miesięcy możesz utworzyć jeszcze {n} wydarzenia.',
    many: 'W ciągu 12 miesięcy możesz utworzyć jeszcze {n} wydarzeń.',
    other: 'W ciągu 12 miesięcy możesz utworzyć jeszcze {n} wydarzenia.',
  },
  'app.home.create.full': 'W ciągu 12 miesięcy można utworzyć najwyżej {limit} wydarzeń. Następne — od {date}.',
  'app.home.create.done': '🎄 Wydarzenie utworzone',
  'app.home.create.doneInvited': '🎄 Wydarzenie utworzone, zaproszenia: {count}',
  'app.home.create.doneInviteError': '🎄 Wydarzenie utworzone. {error}',
};
