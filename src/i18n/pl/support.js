// Texts of src/support.js (060): participant requests to the organizers (012). {name}, {author}, {to} — names (HTML
// already escaped), {title} — event title in quotes, {text} — message text.
export default {
  // Refusals
  'support.noRecipients': 'Nie ma teraz komu odpowiedzieć na zgłoszenie.',
  'support.closed': 'Zgłoszenie jest już zamknięte.',
  'support.notFound': 'Nie znaleziono zgłoszenia.',
  'support.ownThread': 'To Twoje zgłoszenie — może je przejąć ktoś inny.',
  'support.sendFailed': 'Nie udało się wysłać — spróbuj jeszcze raz.',
  'support.noOpen': 'Brak otwartego zgłoszenia.',
  'support.hidden': 'Zgłoszenie prowadzi {name} — czat widzą ta osoba i właściciel.',
  'support.alreadyTaken': 'Zgłoszenie zostało już przejęte — prowadzi je {name}.',
  'support.takeOwn': 'Nie można przejąć własnego zgłoszenia.',
  'support.ledBy': 'Zgłoszenie prowadzi {name}.',
  'support.passRights': 'Przekazać zgłoszenie może osoba, która je prowadzi, albo właściciel.',
  'support.passTarget': 'Przekazać można właścicielowi lub innemu administratorowi.',
  'support.alreadyLed': 'Zgłoszenie i tak prowadzi {name}.',
  'support.passRace': 'Zgłoszenie zmieniło się w trakcie tej operacji — odśwież ekran i spróbuj jeszcze raz.',
  'support.closeRights': 'Zamknąć zgłoszenie może osoba, która je prowadzi, albo właściciel.',
  // Assignee without a name (event screen counters)
  'support.assigneeFallback': 'osoba odpowiedzialna',
  // Buttons under notifications
  'support.openButton': '💬 Otwórz',
  'support.takeButton': '🙋 Przejmij',
  // Who replied or closed — to the participant ({role})
  'support.role.owner': 'Właściciel',
  'support.role.admin': 'Administrator',
  // Notifications to the organizers
  'support.notice.opened': '🆘 <b>{name}</b> prosi o pomoc w wydarzeniu {title}:\n\n{text}',
  'support.notice.added': '💬 <b>{name}</b> uzupełnia zgłoszenie ({title}):\n\n{text}',
  'support.notice.writes': '💬 <b>{name}</b> pisze w zgłoszeniu ({title}):\n\n{text}',
  'support.notice.closedByUser': '✅ <b>{name}</b> zamyka zgłoszenie ({title}).',
  'support.notice.taken': '🙋 <b>{name}</b> przejmuje zgłoszenie (<b>{author}</b>, {title}).',
  'support.notice.passedToYou': '↪️ <b>{name}</b> przekazuje Ci zgłoszenie (<b>{author}</b>, {title}).',
  'support.notice.passed': '↪️ <b>{name}</b> przekazuje zgłoszenie (<b>{author}</b>, {title}) — teraz prowadzi je <b>{to}</b>.',
  'support.notice.closed': '✅ <b>{name}</b> zamyka zgłoszenie (<b>{author}</b>, {title}).',
  'support.notice.returned': '🔄 Zgłoszenie (<b>{author}</b>, {title}) znów jest nieprzypisane.',
  // Notifications to the participant
  'support.user.taken': '🙋 Twoje zgłoszenie w wydarzeniu {title} przejmuje <b>{name}</b> — odpowiedź przyjdzie tutaj.',
  'support.user.reply': '💬 {role} <b>{name}</b> odpowiada ({title}):\n\n{text}',
  'support.user.passed': '↪️ Twoje zgłoszenie w wydarzeniu {title} prowadzi teraz <b>{name}</b>.',
  'support.user.closed': '✅ {role} <b>{name}</b> zamyka Twoje zgłoszenie w wydarzeniu {title}. Jeśli sprawa jest wciąż aktualna — po prostu napisz ponownie.',
  'support.user.returned': '🔄 Twoje zgłoszenie w wydarzeniu {title} znów czeka na odpowiedź.',
};
