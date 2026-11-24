// Texts of src/setup.js (060): /setup page, commands, menu button and bot descriptions. Paragraph markup (<code>, <b>)
// is part of the text
export default {
  'setup.title': "Configuration",
  // Key form
  'setup.form.label': "Clé de configuration (valeur du secret ADMIN_SECRET)",
  'setup.form.clear': "Effacer le champ « Clé de configuration »",
  'setup.form.submit': "Configurer le bot",
  'setup.noSecret.title': "ADMIN_SECRET requis",
  'setup.noSecret.text': "Définis le secret ADMIN_SECRET d'au moins 8 caractères (voir les instructions).",
  'setup.start.title': "🎄 Configuration du bot",
  'setup.start.text': "Saisis la clé de configuration — celle que tu as définie avec la commande\n<code>npx wrangler secret put ADMIN_SECRET</code>.",
  'setup.badKey.title': "Clé incorrecte",
  'setup.badKey.text': "La clé ne correspond pas. Vérifie la valeur d'ADMIN_SECRET.",
  // The owner link has been used
  'setup.locked.title': "🔒 Page verrouillée",
  'setup.locked.used': "Le lien de propriétaire a déjà été utilisé : la page de configuration ne le fournit donc plus et ne modifie plus les réglages du bot.",
  'setup.locked.unlock': "Pour la déverrouiller (par exemple si le lien a fuité ou s'il faut reprendre les droits de propriétaire), change la clé :",
  'setup.locked.then': "Rouvre ensuite cette page et saisis la nouvelle clé — un nouveau lien de propriétaire apparaîtra, l'ancien ne fonctionnera plus.",
  // Setup steps
  'setup.step.token': "Jeton du bot",
  'setup.step.webhook': "Webhook",
  'setup.step.commands': "Commandes",
  'setup.step.menuButton': "Bouton de l'appli",
  // 061: commands and descriptions in other languages are sent in parts along with people's requests
  'setup.profileLater': "le bot transmettra les autres langues à Telegram dans les prochaines minutes",
  'setup.failed': "Échec",
  // Commands, menu button and bot descriptions in Telegram
  'setup.command.start': "Menu principal et mes événements",
  'setup.command.language': "Langue du bot",
  'setup.command.cancel': "Annuler la saisie",
  'setup.menuButton': "🎁 Père Noël",
  'setup.description': "🎄 Bot privé pour jouer au Père Noël secret : lettres au Père Noël, tirage au sort avec exclusions, questions anonymes. Accès par lien d'invitation à un événement.",
  'setup.shortDescription': "🎄 Père Noël secret entre amis, en famille ou entre collègues",
  // Result
  'setup.done.ok': "✅ Bot configuré",
  'setup.done.problems': "⚠️ Il y a des problèmes",
  'setup.done.linkTitle': "1. Lien de propriétaire",
  'setup.done.linkText': "Ouvre-le dans Telegram — le bot fera de toi le <b>propriétaire du bot</b>. Le propriétaire crée les événements, nomme et retire\nles administrateurs dans l'appli (écran d'accueil → « Propriétaire et administrateurs ») et peut ouvrir la vue de contrôle des paires.",
  'setup.done.linkWarn': "⚠️ Le lien <b>ne fonctionne qu'une fois</b> : après l'avoir ouvert, cette page est verrouillée jusqu'à ce que tu changes\nADMIN_SECRET. Ne le transmets à personne — la première personne qui l'ouvre deviendra propriétaire. Si c'est arrivé, change ADMIN_SECRET,\nrouvre la page et utilise le nouveau lien. Tant que le lien n'a pas été utilisé, la page peut être rouverte.",
  'setup.done.eventTitle': "2. Crée un événement",
  'setup.done.eventText': "Dans la discussion avec le bot, appuie sur « 🎁 Père Noël » → « 🎄 Créer ». Chaque événement a son propre lien d'invitation — tu peux\nle copier ou l'envoyer dans une discussion directement depuis l'appli (onglet « Gestion » de l'événement).",
};
