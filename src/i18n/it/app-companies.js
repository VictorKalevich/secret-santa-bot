// Texts of the app part 04-companies (060): "Rooms" screen, "Room" sheet, owner link, bot owner rights. In texts for people -
// "room" (059)
export default {
  // Person's role in the room row
  // "Rooms" screen
  'app.companies.title': "Stanze",
  'app.companies.empty': "Non ci sono ancora stanze. Creane una tua, oppure chiedi il link d'invito a un evento.",
  'app.companies.emptyBotOwner': "Non ci sono ancora stanze.",
  'app.companies.create': "🚪 Crea una stanza",
  'app.companies.ownLimit': "Puoi gestire al massimo due stanze tue: cedine o eliminane una.",
  'app.companies.botLog': "📜 Registro del bot",
  // Room row: who is the owner, how many events; buttons
  'app.companies.about': "Proprietario: {owner} · eventi: {events}",
  'app.companies.aboutIdle': "Proprietario: {owner} · eventi: {events} · nessuno in corso",
  'app.companies.roomName': "Nome della stanza",
  'app.companies.ownName': "Nome per te",
  'app.companies.settings': "Stanza",
  // Name sheet
  'app.companies.label.field': "Nome",
  'app.companies.label.shared': "Questo nome lo vedono tutte le persone della stanza.",
  'app.companies.label.botOwner': "Il nome della stanza lo vedi solo tu, proprietario del bot.",
  'app.companies.label.own': "Questo nome lo vedi solo tu.",
  'app.companies.label.saved': "Nome salvato",
  // New room
  'app.companies.new.title': "Nuova stanza",
  'app.companies.new.placeholder': "Ad esempio: Lavoro",
  'app.companies.new.done': "🚪 Stanza creata",
  'app.companies.new.hintOwn': "Diventerai il proprietario della stanza: crei eventi, inviti persone, nomini amministratori. Il nome lo vedranno tutte le persone della stanza.",
  'app.companies.new.hintBot': "Ogni stanza ha le sue persone, i suoi eventi, famiglie e amministratori. Puoi gestirla tu o affidarla a un proprietario tramite link.",
  // Bot owner's "Room" sheet: who leads it
  'app.companies.lead.title': "Chi la gestisce",
  'app.companies.lead.you': "Tu",
  'app.companies.lead.botRun': "La stanza non ha un suo proprietario: la gestisci tu.",
  'app.companies.lead.owner': "Proprietario della stanza: amministratori, reset ed eliminazione degli eventi, vista riservata delle coppie.",
  'app.companies.lead.self': "Gestiscila tu",
  'app.companies.lead.selfConfirm': "Gestire tu la stanza? «{name}» resterà amministratore.",
  'app.companies.lead.selfDone': "Ora gestisci di nuovo tu la stanza",
  // Room owner link
  'app.companies.link.title': "🔗 Link del proprietario della stanza",
  'app.companies.link.hint': "Il link vale una sola volta: chi lo apre per primo diventa proprietario della stanza e potrà vedere le coppie dei suoi eventi. Invialo solo alla persona giusta.",
  'app.companies.link.active': "Il link è attivo. Non si può mostrare di nuovo, ma puoi crearne uno nuovo.",
  'app.companies.link.copy': "📋 Copia",
  'app.companies.link.shareText': "👑 Link del proprietario in «Babbo Natale segreto»: aprilo per gestire la tua stanza.",
  'app.companies.link.create': "Crea un link",
  'app.companies.link.renew': "Creane uno nuovo",
  'app.companies.link.revoke': "Revoca",
  'app.companies.link.revoked': "Link revocato",
  // Deleting an empty room (sheet with a confirmation word)
  'app.companies.delete.section': "Eliminazione",
  'app.companies.delete.hasEvents': "Nella stanza ci sono eventi: prima eliminali.",
  'app.companies.delete.button': "🗑 Elimina la stanza",
  'app.companies.delete.title': "Elimina la stanza",
  'app.companies.delete.lines': ["le sue persone, gli amministratori e le famiglie;", "il registro comune della stanza."],
  'app.companies.delete.keepBot': "Nella stanza non ci sono eventi. Il proprietario e gli amministratori riceveranno un messaggio.",
  'app.companies.delete.keepOwn': "Nella stanza non ci sono eventi. I suoi amministratori riceveranno un messaggio.",
  'app.companies.delete.done': "Stanza eliminata",
  // Passing the bot owner rights
  'app.companies.botOwner.pass': "👑 Cedi il ruolo di proprietario del bot",
  'app.companies.botOwner.title': "Ruolo di proprietario del bot",
  'app.companies.botOwner.hint': "Il proprietario del bot è uno solo. Puoi cedere il ruolo a una persona delle stanze che gestisci.",
  'app.companies.botOwner.choose': "A chi cederlo…",
  'app.companies.botOwner.confirm': "Cedere il ruolo di proprietario del bot a «{name}»? Potrà creare ed eliminare stanze e nominarne i proprietari. Resterai amministratore delle tue stanze.",
  'app.companies.botOwner.done': "👑 Ruolo di proprietario del bot ceduto",
};
