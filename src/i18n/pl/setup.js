// Texts of src/setup.js (060): the /setup page, commands, menu button and bot descriptions. Paragraph markup
// (<code>, <b>) is part of the text
export default {
  'setup.title': 'Konfiguracja',
  // Key form
  'setup.form.label': 'Klucz konfiguracji (wartość sekretu ADMIN_SECRET)',
  'setup.form.clear': 'Wyczyść pole „Klucz konfiguracji”',
  'setup.form.submit': 'Skonfiguruj bota',
  'setup.noSecret.title': 'Potrzebny ADMIN_SECRET',
  'setup.noSecret.text': 'Ustaw sekret ADMIN_SECRET o długości co najmniej 8 znaków (zob. instrukcję).',
  'setup.start.title': '🎄 Konfiguracja bota',
  'setup.start.text': 'Wpisz klucz konfiguracji — ten, który ustawiono poleceniem\n<code>npx wrangler secret put ADMIN_SECRET</code>.',
  'setup.badKey.title': 'Nieprawidłowy klucz',
  'setup.badKey.text': 'Klucz nie pasuje. Sprawdź wartość ADMIN_SECRET.',
  // The owner link has already been used
  'setup.locked.title': '🔒 Strona zablokowana',
  'setup.locked.used': 'Link właściciela został już użyty, dlatego strona konfiguracji nie wydaje go ponownie i nie zmienia ustawień bota.',
  'setup.locked.unlock': 'Aby odblokować (np. jeśli link wyciekł albo trzeba odebrać prawa właściciela), zmień klucz:',
  'setup.locked.then': 'Następnie otwórz tę stronę ponownie i wpisz nowy klucz — pojawi się nowy link właściciela, a stary przestanie działać.',
  // Setup steps
  'setup.step.token': 'Token bota',
  'setup.step.webhook': 'Webhook',
  'setup.step.commands': 'Polecenia',
  'setup.step.menuButton': 'Przycisk aplikacji',
  // 061: commands and descriptions in other languages are sent in parts along with people's requests
  'setup.profileLater': 'pozostałe języki bot przekaże Telegramowi w ciągu kilku minut',
  'setup.failed': 'Nie udało się',
  // Commands, menu button and bot descriptions in Telegram
  'setup.command.start': 'Menu główne i moje wydarzenia',
  'setup.command.language': 'Język bota',
  'setup.command.cancel': 'Anuluj wpisywanie',
  'setup.menuButton': '🎁 Mikołaj',
  'setup.description': '🎄 Zamknięty bot do gry w Tajemniczego Mikołaja: listy do Mikołaja, losowanie z wykluczeniami, anonimowe pytania. Wejście przez link z zaproszeniem do wydarzenia.',
  'setup.shortDescription': '🎄 Tajemniczy Mikołaj dla przyjaciół, rodziny i współpracowników',
  // Result
  'setup.done.ok': '✅ Bot skonfigurowany',
  'setup.done.problems': '⚠️ Są problemy',
  'setup.done.linkTitle': '1. Link właściciela',
  'setup.done.linkText': 'Otwórz go w Telegramie — bot uczyni Cię <b>właścicielem bota</b>. Właściciel tworzy wydarzenia, mianuje i odwołuje\nadministratorów w aplikacji (ekran główny → „Właściciel i administratorzy”) i może otworzyć podgląd serwisowy par.',
  'setup.done.linkWarn': '⚠️ Link <b>działa tylko raz</b>: po jego użyciu ta strona zostaje zablokowana, dopóki nie zmienisz\nADMIN_SECRET. Nikomu go nie przesyłaj — kto użyje go pierwszy, zostanie właścicielem. Jeśli tak się stało, zmień ADMIN_SECRET,\notwórz stronę ponownie i użyj nowego linku. Dopóki link nie został użyty, stronę można otwierać ponownie.',
  'setup.done.eventTitle': '2. Utwórz wydarzenie',
  'setup.done.eventText': 'W czacie z botem naciśnij „🎁 Mikołaj” → „🎄 Utwórz”. Każde wydarzenie ma własny link z zaproszeniem — można go\nskopiować albo wysłać do czatu prosto z aplikacji (zakładka „Zarządzanie” wydarzenia).',
};
