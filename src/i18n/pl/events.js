// Texts of src/events.js (060): creation, finishing, deletion, reset, invitations, reveal, reminders, announcements,
// event settings
export default {
  'events.titleRule': 'Nazwa wydarzenia — od 1 do 80 znaków.',
  'events.openButton': '🎁 Otwórz',
  // Finishing
  'events.alreadyFinished': 'Wydarzenie jest już zakończone.',
  'events.finished': '🏁 <b>Wydarzenie {title} zakończone.</b> Dziękujemy za grę!\n\nList do Mikołaja jest teraz tylko do odczytu. Czat pozostaje otwarty jeszcze przez 7 dni (do {until}), potem będzie tylko do odczytu. Historia wydarzenia zostanie w aplikacji.',
  'events.finishedButton': '📚 Otwórz',
  // Deletion and full reset
  'events.deleted': '🗑 Właściciel usunął wydarzenie {title} razem z listami i czatami.',
  'events.alreadyDeleted': 'Wydarzenie zostało już usunięte.',
  'events.reset': '🎄 Właściciel rozpoczął wydarzenie {title} od nowa. Wcześniejsze dane zostały usunięte. Aby wziąć udział, poproś o nowy link z zaproszeniem.',
  'events.resetRace': 'Wydarzenie zostało już zresetowane lub zmieniło się w trakcie resetu — odśwież ekran.',
  // Inviting participants of another event
  'events.registrationClosed': 'Rejestracja jest zamknięta — otwórz ją, aby zapraszać.',
  'events.setupFirst': 'Najpierw otwórz stronę konfiguracji /setup (zob. README).',
  'events.invite': '📨 <b>Zaproszenie do wydarzenia {title}</b> — Tajemniczy Mikołaj.\nNaciśnij przycisk, aby wziąć udział.',
  'events.inviteButton': '🎄 Biorę udział',
  'events.inviteAgain': 'Zaproszenia zostały już wysłane — ponowić można za minutę.',
  // Reveal: {name} — Santa's name
  'events.alreadyRevealed': 'Tajemnica została już ujawniona.',
  'events.revealed': '🎅 <b>Tajemnica ujawniona!</b>\n\nW wydarzeniu {title} Twoim Tajemniczym Mikołajem jest <b>{name}</b>. Wesołych Świąt! 🎄',
  // Reminders: empty letter (with and without a deadline) and to Santas (with and without a gift date)
  'events.remindAgain': 'Przypomnienie zostało już wysłane — ponowić można za minutę.',
  'events.remindUnfilled': '⏰ Przypomnienie: Twój list do Mikołaja w wydarzeniu {title} jest wciąż pusty. Wypełnij go, żeby Mikołajowi łatwiej było wybrać prezent.',
  'events.remindUnfilledBy': '⏰ Przypomnienie: Twój list do Mikołaja w wydarzeniu {title} jest wciąż pusty. Wypełnij go do <b>{date}</b>, żeby Mikołajowi łatwiej było wybrać prezent.',
  'events.remindSantas': '🎁 Przypomnienie dla Mikołaja ({title}): czy prezent dla podopiecznego jest już gotowy?\nGdy będzie gotowy — zaznacz to w zakładce „Podopieczny”.',
  'events.remindSantasDated': '🎁 Przypomnienie dla Mikołaja ({title}): czy prezent dla podopiecznego jest już gotowy? Wręczenie — <b>{date}</b>.\nGdy będzie gotowy — zaznacz to w zakładce „Podopieczny”.',
  // Announcements (007)
  'events.announceFinished': 'Wydarzenie jest zakończone — nie można już w nim wysyłać ogłoszeń.',
  'events.announceEmpty': 'Napisz treść ogłoszenia.',
  'events.announcement': '📣 <b>Ogłoszenie · {title}</b>\n\n{text}',
  'events.announcementButton': '📌 Otwórz wydarzenie',
  'events.announceAgain': 'To ogłoszenie zostało już wysłane.',
  // Settings
  'events.ringAfterDraw': 'Po losowaniu nie można zmienić losowania w kręgu.',
  // Log details
  'events.auditText.fromTemplate': 'na wzór „{title}”',
  'events.auditText.deleted': '„{title}”, uczestników: {n}',
  'events.auditText.reset': 'usunięto uczestników: {n}',
  'events.auditText.invited': 'z „{title}”, zaproszono: {n}',
  'events.auditText.pairs': 'par: {n}',
  'events.auditText.received': 'otrzymali: {n}',
  'events.auditText.settings': 'ustawienia',
  'events.auditText.ring': 'losowanie w kręgu: {state}',
  'events.auditText.avoidPrevious': 'bez powtarzania poprzednich par: {state}',
  'events.auditText.on': 'wł.',
  'events.auditText.off': 'wył.',
  'events.auditText.registrationOpen': 'otwarta',
  'events.auditText.registrationClosed': 'zamknięta',
};
