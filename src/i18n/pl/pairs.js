// Texts of src/pairs.js (060): draw, inserting, removal, cancellation, giftee swap
export default {
  // Why the draw is impossible (pairs.reason.<problem type of draw.js>); {name} — a participant
  'pairs.reason.too_few': 'Potrzeba co najmniej 2 uczestników.',
  'pairs.reason.ring_too_few': 'Losowanie w kręgu wymaga co najmniej 3 uczestników — albo wyłącz losowanie w kręgu w ustawieniach.',
  'pairs.reason.ring_impossible': 'Wygląda na to, że przy takich wykluczeniach nie da się uniknąć par wzajemnych. Spróbuj jeszcze raz; jeśli się nie uda — usuń część wykluczeń albo wyłącz losowanie w kręgu.',
  'pairs.reason.no_receivers': '{name} nie może nikogo obdarować — sprawdź wykluczenia.',
  'pairs.reason.no_givers': 'Nikt nie może wylosować osoby {name} — sprawdź wykluczenia.',
  'pairs.reason.search_exhausted': 'Nie udało się szybko dobrać przydziału — spróbuj jeszcze raz. Jeśli się nie uda, usuń część wykluczeń albo wyłącz losowanie w kręgu.',
  'pairs.reason.fixed_block': 'Przeszkadzają ustalone pary: z nimi nie da się przydzielić wszystkich zgodnie z regułami. {owner.nomCap} może usunąć część ustalonych par.',
  'pairs.reason.too_strict': 'Za dużo wykluczeń: nie da się przydzielić wszystkich tak, by ich nie złamać. Usuń część wykluczeń.',
  'pairs.familiesBlock': 'Przeszkadzają rodziny: członkowie jednej rodziny nie obdarowują się nawzajem i nie da się tak przydzielić wszystkich. Wyłącz „Uwzględniaj rodziny” albo losowanie w kręgu.',
  // Draw
  'pairs.drawn': '🎄 <b>Losowanie w wydarzeniu {title} przeprowadzone!</b>\n\nOtwórz aplikację i zajrzyj do zakładki „Podopieczny”, żeby się dowiedzieć, komu dajesz prezent. Nikomu nie mów 🤫',
  'pairs.drawnButton': '🎁 Poznaj podopiecznego',
  'pairs.drawFinished': 'Wydarzenie jest zakończone.',
  'pairs.drawRace': 'W trakcie losowania zmienili się uczestnicy, wykluczenia lub rodziny — spróbuj jeszcze raz.',
  'pairs.notDrawn': 'Losowanie się nie odbyło.',
  // Pairs after a change of members: to the new participant and to a Santa with a new giftee
  'pairs.inserted': '🎄 <b>Jesteś w grze!</b> Losowanie w wydarzeniu {title} zostało dla Ciebie przeprowadzone — zajrzyj do zakładki „Podopieczny” 🤫',
  'pairs.newWard': '🔄 Skład wydarzenia {title} się zmienił i masz teraz <b>nowego podopiecznego</b>. Zajrzyj do zakładki „Podopieczny”.',
  'pairs.lookButton': '🎁 Zobacz',
  // Removing and inserting a participant
  'pairs.notMember': 'Ta osoba nie uczestniczy w tym wydarzeniu.',
  'pairs.removeBlocked': 'Nie da się usunąć uczestnika bez naruszenia wykluczeń lub losowania w kręgu. Złagodź wykluczenia.',
  'pairs.removed': 'Usunięto Cię z wydarzenia {title}. Jeśli to pomyłka, skontaktuj się z właścicielem lub administratorem.',
  'pairs.alreadyInDraw': 'Uczestnik jest już w losowaniu.',
  'pairs.insertBlocked': 'Nie da się dopisać uczestnika bez naruszenia reguł: prezenty są już gotowe u wszystkich, którym mógłby zmienić się podopieczny, albo przeszkadzają wykluczenia. Możesz anulować losowanie w strefie niebezpiecznej i przeprowadzić je od nowa.',
  // Giftee swap (048): rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': 'Jedna z tych osób obdarowuje drugą: po zamianie ktoś dawałby prezent samemu sobie.',
  'pairs.swapRule.exclusion': 'Wykluczenia: jedna z tych dwóch osób obdarowywałaby kogoś, kogo według wykluczeń obdarowywać nie powinna.',
  'pairs.swapRule.family': 'Rodziny: jedna z tych dwóch osób obdarowywałaby członka swojej rodziny.',
  'pairs.swapRule.ring': 'Losowanie w kręgu: powstanie para wzajemna — dwie osoby będą się obdarowywać nawzajem.',
  'pairs.swapRule.fixed': 'Ustalone pary: zamiana rozerwie ustaloną przez Ciebie parę.',
  'pairs.swapRule.history': 'Poprzednie pary: jedna z tych dwóch osób obdarowywałaby tę samą osobę co w poprzednim wydarzeniu.',
  'pairs.swapRevealed': 'Tajemnica została już ujawniona — nie można zmieniać podopiecznych.',
  'pairs.swapTwo': 'Wybierz dwóch różnych uczestników.',
  'pairs.notInDraw': 'Uczestnik nie jest w losowaniu.',
  'pairs.swapStale': 'Pary już się zmieniły — otwórz zamianę od nowa.',
  'pairs.swapSelf': 'Tych dwóch osób nie można zamienić — wybierz inną parę.',
  'pairs.swapRulesChanged': 'Reguły losowania dla tej zamiany się zmieniły — sprawdź jeszcze raz.',
  'pairs.swapNotice': '🔄 Właściciel zmienił losowanie w wydarzeniu {title}: masz teraz <b>nowego podopiecznego</b>. Poprzednia para już nie obowiązuje, czat w niej został usunięty. Zajrzyj do zakładki „Podopieczny”.',
  // Draw cancellation (007) and forced cancellation (012)
  'pairs.cancelFinished': 'Wydarzenie jest zakończone — nie można anulować losowania.',
  'pairs.cancelRevealed': 'Tajemnica została już ujawniona — nie można anulować losowania.',
  'pairs.cancelBlocked': 'Nie można anulować: ktoś już otworzył podopiecznego albo zaczął się czat.',
  'pairs.cancelled': '↩️ <b>Losowanie anulowane</b> w wydarzeniu {title}. Twój list do Mikołaja został zachowany. Gdy będzie nowe losowanie, bot napisze.',
  'pairs.forceCancelled': '↩️ Właściciel <b>anulował losowanie</b> w wydarzeniu {title}. Poprzednia para już nie obowiązuje, czat z Mikołajem i podopiecznym został usunięty. Twój list został zachowany. Gdy będzie nowe losowanie, bot napisze.',
  // Log details
  'pairs.auditText.members': 'uczestników: {n}',
  'pairs.auditText.changed': 'zmienionych par: {n}',
  'pairs.auditText.removed': 'usuniętych par: {n}',
};
