// Texts of src/roles.js (060): bot owner, event owner and admins (063), participation transfer. {name}, {from}, {to},
// {actor}, {who} in messages - names (HTML), {title} - the event title in quotes (HTML)
export default {
  // App button under a message about new rights
  'roles.openButton': '🛠 Otwórz',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ Prawa właściciela bota przeszły na <b>{name}</b> przez link ze strony konfiguracji. Twoje wydarzenia zostają przy Tobie.\n\nJeśli to nie Ty i nie było takiej umowy — zmień ADMIN_SECRET (zob. README), otwórz stronę konfiguracji i użyj nowego linku właściciela.',
  'roles.botOwner.transferred': '👑 <b>Przekazano Ci prawa właściciela bota.</b> Dziennik bota, wszystkie wydarzenia i przekazanie praw — w aplikacji: ⚙️ „Ustawienia” → „Właściciel bota”.',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> jest teraz właścicielem bota.',
  // Passing the bot owner rights
  'roles.transferTarget': 'Prawa właściciela można przekazać tylko zarejestrowanej osobie.',
  'roles.alreadyOwnerSelf': 'Już jesteś właścicielem.',
  'roles.alreadyTransferred': 'Prawa właściciela zostały już przekazane.',
  // Event admins
  'roles.alreadyAdmin': 'Ta osoba jest już administratorem.',
  'roles.notAdmin': 'Ta osoba nie jest administratorem.',
  'roles.grantMember': 'Mianować można tylko uczestnika wydarzenia.',
  'roles.revokeOwner': 'Nie można odebrać praw właściciela. Najpierw przekaż prawa właściciela wydarzenia.',
  'roles.granted': '🛠 <b>Mianowano Cię administratorem wydarzenia {title}.</b>\n\nTeraz możesz je prowadzić: zaproszenia, wykluczenia, losowanie, przypomnienia. Pary może zobaczyć tylko właściciel wydarzenia w podglądzie serwisowym.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> jest teraz administratorem wydarzenia {title}.',
  'roles.revoked': 'Odebrano Ci prawa administratora wydarzenia {title}. Jeśli w nim uczestniczysz, grasz dalej jak zwykle.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> nie jest już administratorem wydarzenia {title}.',
  // Event ownership
  'roles.owner.already': 'Ta osoba jest już właścicielem.',
  'roles.owner.target': 'Prawa właściciela można przekazać tylko uczestnikowi lub administratorowi wydarzenia.',
  'roles.owner.alreadyPassed': 'Prawa właściciela wydarzenia zostały już przekazane.',
  'roles.owner.toNew': '👑 <b>Jesteś teraz właścicielem wydarzenia {title}.</b> Mianujesz administratorów, otwierasz podgląd serwisowy, resetujesz i usuwasz wydarzenie — wszystko w aplikacji.',
  'roles.owner.toPrev': 'ℹ️ Prawa właściciela wydarzenia {title} przeszły na <b>{who}</b>. Pozostajesz administratorem.',
  'roles.owner.notice': 'ℹ️ Właścicielem wydarzenia {title} jest teraz <b>{who}</b>.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Wybierz dwa różne konta.',
  'roles.transfer.staffTarget': 'Nie można przenieść udziału na konto właściciela ani administratora.',
  'roles.transfer.noOld': 'Nie znaleziono starego konta.',
  'roles.transfer.unregistered': 'Nowe konto musi dokończyć rejestrację (napisać botowi imię).',
  'roles.transfer.inDraw': 'Nowe konto już bierze udział w losowaniu wydarzenia „{title}” — wybierz inne konto.',
  'roles.transfer.toNew': '🔁 Właściciel bota przeniósł na to konto Twój udział w grze „Tajemniczy Mikołaj”: listy, podopieczni, czaty i historia wydarzeń zostały zachowane.',
  'roles.transfer.toOld': '🔁 Twój udział w grze „Tajemniczy Mikołaj” został przeniesiony na konto <b>{to}</b>. Jeśli to nie była Twoja prośba, skontaktuj się z właścicielem bota.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> przenosi udział: <b>{from}</b> → <b>{to}</b>.',
  // Log: new owner; move "old record → new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
