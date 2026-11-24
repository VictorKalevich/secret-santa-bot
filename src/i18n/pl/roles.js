// Texts of src/roles.js (060): bot owner, admins, moving participation. {name}, {from}, {to}, {actor} — names (HTML)
export default {
  'roles.openButton': '🛠 Otwórz',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ Prawa właściciela bota przeszły na <b>{name}</b> przez link ze strony konfiguracji. Pozostajesz administratorem.\n\nJeśli to nie Ty i nie było takiej umowy — zmień ADMIN_SECRET (zob. README), otwórz stronę konfiguracji i użyj nowego linku właściciela.',
  'roles.botOwner.transferred': '👑 <b>Przekazano Ci prawa właściciela bota.</b> Teraz mianujesz i odwołujesz administratorów — sekcja „Właściciel i administratorzy” na ekranie głównym aplikacji.',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> jest teraz właścicielem bota.',
  // Passing owner rights (bot and room)
  'roles.transferTarget': 'Prawa właściciela można przekazać tylko zarejestrowanej osobie.',
  'roles.alreadyOwnerSelf': 'Już jesteś właścicielem.',
  'roles.alreadyTransferred': 'Prawa właściciela zostały już przekazane.',
  // Admins
  'roles.alreadyAdmin': 'Ta osoba jest już administratorem.',
  'roles.notAdmin': 'Ta osoba nie jest administratorem.',
  'roles.grantUnregistered': 'Mianować można tylko zarejestrowaną osobę.',
  'roles.revokeOwner': 'Nie można odebrać praw właściciela. Najpierw przekaż prawa właściciela.',
  'roles.granted': '🛠 <b>Właściciel mianował Cię administratorem.</b>\n\nTeraz możesz tworzyć wydarzenia i je prowadzić: zaproszenia, wykluczenia, losowanie, przypomnienia. Pary może zobaczyć tylko właściciel w podglądzie serwisowym.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> jest teraz administratorem.',
  'roles.revoked': 'Właściciel odebrał Ci prawa administratora. Jako uczestnik wydarzeń grasz dalej jak zwykle.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> nie jest już administratorem.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Wybierz dwa różne konta.',
  'roles.transfer.staffTarget': 'Nie można przenieść udziału na konto właściciela ani administratora.',
  'roles.transfer.noOld': 'Nie znaleziono starego konta.',
  'roles.transfer.unregistered': 'Nowe konto musi dokończyć rejestrację (napisać botowi imię).',
  'roles.transfer.inDraw': 'Nowe konto już bierze udział w losowaniu wydarzenia „{title}” — wybierz inne konto.',
  'roles.transfer.toNew': '🔁 Właściciel przeniósł na to konto Twój udział w grze „Tajemniczy Mikołaj”: listy, podopieczni, czaty i historia wydarzeń zostały zachowane.',
  'roles.transfer.toOld': '🔁 Twój udział w grze „Tajemniczy Mikołaj” został przeniesiony na konto <b>{to}</b>. Jeśli to nie była Twoja prośba, skontaktuj się z właścicielem.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> przenosi udział: <b>{from}</b> → <b>{to}</b>.',
  // Log: new owner; move "old record → new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
