// Texts of src/companies.js (060): rooms - creation, names, room owner, owner link, deletion. Owner-rights refusals are
// shared with roles.js (roles.* keys)
export default {
  // Refusals
  'companies.ownLimit': "Puoi gestire al massimo due stanze tue: cedine o eliminane una.",
  'companies.recent': "Una stanza con questo nome è appena stata creata.",
  'companies.nameRule': "Il nome della stanza deve avere da 1 a 40 caratteri.",
  'companies.labelRule': "Il nome può avere fino a 40 caratteri.",
  'companies.hasEvents': "Nella stanza ci sono eventi: prima eliminali.",
  'companies.ownDelete': "Solo il proprietario della stanza può eliminarla.",
  'companies.alreadyOwner': "Ha già il ruolo di proprietario.",
  // Room owner link (bot: /start own_<code>)
  'companies.ownerLinkGone': "Questo link del proprietario è già stato usato o revocato. Chiedine uno nuovo.",
  'companies.newOwner': "👑 Sei il proprietario della tua stanza in «Babbo Natale segreto»: crei eventi, inviti persone e nomini amministratori.",
  // Room name without own or shared name - its number among the person's rooms
  'companies.numbered': "Stanza {n}",
  // Room owner change: {who}, {by} - names (HTML), {title} - room name in quotes
  'companies.owner.transferred': "👑 <b>Ora sei il proprietario della stanza.</b> Nomini e revochi gli amministratori, resetti ed elimini gli eventi, apri la vista riservata: tutto nell'app.",
  'companies.owner.returned': "👑 <b>{by}</b> ti ha passato la stanza {title}: ora la gestisci di nuovo tu.",
  'companies.owner.prevNext': "ℹ️ Il ruolo di proprietario della stanza ora è di <b>{who}</b>. Resti amministratore.",
  'companies.owner.prevBot': "ℹ️ La stanza torna a essere gestita dal proprietario del bot. Resti amministratore.",
  'companies.owner.byLink': "👑 <b>{who}</b> è ora il proprietario della stanza {title}.",
  'companies.owner.byLinkUsername': "👑 <b>{who}</b> (@{username}) è ora il proprietario della stanza {title}.",
  'companies.owner.passed': "ℹ️ <b>{by}</b> ha ceduto il ruolo di proprietario della stanza {title}: ora il proprietario è <b>{who}</b>.",
  'companies.owner.notice': "ℹ️ <b>{who}</b> è ora il proprietario.",
  // Deleting an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': "Il proprietario ha eliminato una stanza in cui eri amministratore: non conteneva eventi.",
  'companies.deleted.yours': "Il proprietario del bot ha eliminato la stanza che gestivi: non conteneva eventi.",
  'companies.deleted.admin': "Il proprietario del bot ha eliminato una stanza in cui eri amministratore: non conteneva eventi.",
  // Log: {title} - room name
  'companies.audit.byLink': "tramite link: {name}",
  'companies.audit.toBotOwner': "→ proprietario del bot",
  'companies.audit.ownerChanged': "«{title}»: {details}",
  'companies.audit.linkRevoked': "«{title}»: revocato",
  'companies.audit.linkCreated': "«{title}»: creato",
  'companies.audit.roomDeleted': "«{title}», persone: {n}",
};
