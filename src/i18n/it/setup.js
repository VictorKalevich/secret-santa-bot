// Texts of src/setup.js (060): /setup page, commands, menu button and bot descriptions. Paragraph markup (<code>, <b>) is
// part of the text
export default {
  'setup.title': "Configurazione",
  // Key form
  'setup.form.label': "Chiave di configurazione (valore del segreto ADMIN_SECRET)",
  'setup.form.clear': "Svuota il campo «Chiave di configurazione»",
  'setup.form.submit': "Configura il bot",
  'setup.noSecret.title': "Serve ADMIN_SECRET",
  'setup.noSecret.text': "Imposta il segreto ADMIN_SECRET di almeno 8 caratteri (vedi le istruzioni).",
  'setup.start.title': "🎄 Configurazione del bot",
  'setup.start.text': "Inserisci la chiave di configurazione, quella che hai impostato con il comando\n<code>npx wrangler secret put ADMIN_SECRET</code>.",
  'setup.badKey.title': "Chiave errata",
  'setup.badKey.text': "La chiave non è corretta. Controlla il valore di ADMIN_SECRET.",
  // The owner link has already been used
  'setup.locked.title': "🔒 Pagina bloccata",
  'setup.locked.used': "Il link del proprietario è già stato usato, quindi la pagina di configurazione non lo mostra più e non cambia le impostazioni del bot.",
  'setup.locked.unlock': "Per sbloccarla (ad esempio se il link è finito in mani sbagliate o devi riprenderti il ruolo di proprietario), cambia la chiave:",
  'setup.locked.then': "Poi riapri questa pagina e inserisci la nuova chiave: comparirà un nuovo link del proprietario e quello vecchio smetterà di funzionare.",
  // Setup steps
  'setup.step.token': "Token del bot",
  'setup.step.webhook': "Webhook",
  'setup.step.commands': "Comandi",
  'setup.step.menuButton': "Pulsante dell'app",
  // 061: commands and descriptions in the other languages go out in parts with people's requests
  'setup.profileLater': "il bot invierà le altre lingue a Telegram nei prossimi minuti",
  'setup.failed': "Configurazione non riuscita",
  // Commands, menu button and bot descriptions in Telegram
  'setup.command.start': "Menu principale e i miei eventi",
  'setup.command.language': "Lingua del bot",
  'setup.command.cancel': "Annulla l'inserimento",
  'setup.menuButton': "🎁 Babbo Natale",
  'setup.description': "🎄 Bot privato per giocare a Babbo Natale segreto: letterine a Babbo Natale, sorteggio con esclusioni, domande anonime. Si entra con il link d'invito a un evento.",
  'setup.shortDescription': "🎄 Babbo Natale segreto per amici, famiglia e colleghi",
  // Result
  'setup.done.ok': "✅ Bot configurato",
  'setup.done.problems': "⚠️ Ci sono problemi",
  'setup.done.linkTitle': "1. Link del proprietario",
  'setup.done.linkText': "Aprilo in Telegram: il bot ti renderà <b>proprietario del bot</b>. Il proprietario crea gli eventi, nomina e revoca\ngli amministratori nell'app (schermata principale → «Proprietario e amministratori») e può aprire la vista riservata delle coppie.",
  'setup.done.linkWarn': "⚠️ Il link <b>funziona una sola volta</b>: dopo averlo aperto, questa pagina resta bloccata finché non cambi\nADMIN_SECRET. Non inoltrarlo a nessuno: chi lo apre per primo diventa proprietario. Se è successo, cambia ADMIN_SECRET,\nriapri la pagina e usa il nuovo link. Finché il link non viene usato, puoi riaprire questa pagina.",
  'setup.done.eventTitle': "2. Crea un evento",
  'setup.done.eventText': "Nella chat con il bot tocca «🎁 Babbo Natale» → «🎄 Crea». Ogni evento ha il suo link d'invito: puoi\ncopiarlo o inviarlo in una chat direttamente dall'app (scheda «Gestione» dell'evento).",
};
