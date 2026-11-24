// Texts of src/setup.js (061, English): the /setup page, commands, menu button and bot descriptions.
// Paragraph markup (<code>, <b>) is part of the text
export default {
  'setup.title': 'Setup',
  // Key form
  'setup.form.label': 'Setup key (the value of the ADMIN_SECRET secret)',
  'setup.form.clear': 'Clear “Setup key”',
  'setup.form.submit': 'Set up the bot',
  'setup.noSecret.title': 'ADMIN_SECRET is needed',
  'setup.noSecret.text': 'Set the ADMIN_SECRET secret, at least 8 characters long (see the instructions).',
  'setup.start.title': '🎄 Bot setup',
  'setup.start.text': 'Enter the setup key — the one you set with the command\n<code>npx wrangler secret put ADMIN_SECRET</code>.',
  'setup.badKey.title': 'Wrong key',
  'setup.badKey.text': 'The key didn’t match. Check the ADMIN_SECRET value.',
  // The owner link has already been used
  'setup.locked.title': '🔒 Page locked',
  'setup.locked.used': 'The owner link has already been used, so the setup page no longer gives it out or changes the bot settings.',
  'setup.locked.unlock': 'To unlock it (for example, if the link leaked or you need to take ownership back), change the key:',
  'setup.locked.then': 'Then open this page again and enter the new key — you’ll get a new owner link, and the old one will stop working.',
  // Setup steps
  'setup.step.token': 'Bot token',
  'setup.step.webhook': 'Webhook',
  'setup.step.commands': 'Commands',
  'setup.step.menuButton': 'App button',
  // 061: commands and descriptions in the other languages are sent in parts along with people's requests
  'setup.profileLater': 'the bot will send the other languages to Telegram in the next few minutes',
  'setup.failed': 'Failed',
  // Commands, menu button and bot descriptions in Telegram
  'setup.command.start': 'Main menu and my events',
  'setup.command.language': 'Bot language',
  'setup.command.cancel': 'Cancel input',
  'setup.menuButton': '🎁 Santa',
  'setup.description': '🎄 A private bot for playing Secret Santa: letters to Santa, a draw with exclusions, anonymous questions. Join with an event invite link.',
  'setup.shortDescription': '🎄 Secret Santa for friends, family and coworkers',
  // Result
  'setup.done.ok': '✅ The bot is set up',
  'setup.done.problems': '⚠️ There are problems',
  'setup.done.linkTitle': '1. Owner link',
  'setup.done.linkText': 'Open it in Telegram — the bot will make you the <b>bot owner</b>. The owner creates events, assigns and removes\nadmins in the app (home screen → “Owner and admins”) and can open the service view of pairs.',
  'setup.done.linkWarn': '⚠️ The link <b>works only once</b>: after it’s opened, this page is locked until you change\nADMIN_SECRET. Don’t forward it to anyone — whoever opens it first becomes the owner. If that happens, change ADMIN_SECRET,\nopen the page again and follow the new link. Until the link is used, you can open this page again.',
  'setup.done.eventTitle': '2. Create an event',
  'setup.done.eventText': 'In the chat with the bot, tap “🎁 Santa” → “🎄 Create”. Each event has its own invite link — you can\ncopy it or send it to a chat right from the app (the event’s “Manage” tab).',
};
