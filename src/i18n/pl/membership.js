// Texts of src/membership.js (060): joining, join requests, families, "I take part", leaving
export default {
  // Families (008)
  'membership.familyNameRule': 'Nazwa rodziny — od 1 do 40 znaków.',
  'membership.familySize': 'Rodzina musi liczyć od 2 do {max} osób.',
  'membership.familyNotFound': 'Nie znaleziono rodziny.',
  'membership.memberNotFound': 'Nie znaleziono uczestnika.',
  'membership.alreadyInFamily': '{name} jest już w rodzinie „{family}”.',
  'membership.familyFrozen': 'Składu rodziny nie można zmieniać, dopóki trwa wydarzenie „{title}” z przeprowadzonym losowaniem: inaczej po zmianach uczestników dałoby się odgadnąć pary. Zmiany — po jego zakończeniu.',
  // Log: family name and members, "I take part"
  'membership.audit.familySave': '„{name}”: {people}',
  'membership.audit.familyDelete': '„{name}”',
  'membership.audit.isParticipant': 'bierze udział',
  'membership.audit.notParticipant': 'nie bierze udziału',
  'membership.afterDraw': 'Po losowaniu tak nie można. Poproś {owner.gen} o dopisanie Cię do losowania.',
  // Leaving (035)
  'membership.leaveAfterDraw': 'Losowanie już się odbyło. Aby wyjść, zwróć się do właściciela lub administratorów.',
  'membership.leaveFinished': 'Wydarzenie jest zakończone — nie można już z niego wyjść.',
  'membership.leaveNotice': '🚪 <b>{name}</b> opuszcza wydarzenie {title}.',
  'membership.openEventButton': '🛠 Otwórz wydarzenie',
  // Return of removed people (010)
  'membership.notRemoved': 'Tej osoby nie ma wśród usuniętych.',
  // Joining and join requests (008)
  'membership.joinedNotice': '👋 <b>{name}</b> dołącza do wydarzenia {title}',
  'membership.request': '🙋 <b>{name}</b> chce wziąć udział w wydarzeniu {title}.',
  'membership.requestWithUsername': '🙋 <b>{name}</b> (@{username}) chce wziąć udział w wydarzeniu {title}.',
  'membership.acceptButton': '✅ Przyjmij',
  'membership.rejectButton': '❌ Odrzuć',
  'membership.requestNotFound': 'Nie znaleziono prośby.',
  'membership.requestDecided': 'Prośba została już rozpatrzona.',
  'membership.approveFinished': 'Wydarzenie jest zakończone — nie można już do niego przyjmować.',
  'membership.approveClosed': 'Rejestracja na wydarzenie „{title}” jest zamknięta — otwórz ją, aby przyjąć prośbę.',
  // Decision on a request: to the person and to the other admins
  'membership.approvedAfterDraw': '🎉 Prośba przyjęta — jesteś w wydarzeniu {title}! Losowanie już się odbyło — {owner.nom} dopisze Cię do niego, bot wyśle powiadomienie. A tymczasem napisz list do Mikołaja.',
  'membership.approved': '🎉 Prośba przyjęta — jesteś w wydarzeniu {title}! Otwórz aplikację i napisz list do swojego Tajemniczego Mikołaja.',
  'membership.requestRejected': 'Prośba o udział w wydarzeniu {title} została odrzucona. Jeśli to pomyłka, skontaktuj się z właścicielem lub administratorem.',
  'membership.approvedBy': '✅ <b>{by}</b> przyjmuje prośbę o udział w wydarzeniu {title}: <b>{name}</b>.',
  'membership.rejectedBy': '❌ <b>{by}</b> odrzuca prośbę o udział w wydarzeniu {title}: <b>{name}</b>.',
};
