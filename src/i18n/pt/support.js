// Texts of src/support.js (060): participant support requests to organizers (012). {name}, {author}, {to} — names
// (HTML already escaped), {title} — event title in quotes, {text} — message text.
export default {
  // Refusals
  'support.noRecipients': 'No momento, não há ninguém para responder ao chamado.',
  'support.closed': 'O chamado já foi encerrado.',
  'support.notFound': 'Chamado não encontrado.',
  'support.ownThread': 'Este chamado é seu — outra pessoa pode assumi-lo.',
  'support.sendFailed': 'Não foi possível enviar — tente de novo.',
  'support.noOpen': 'Não há chamado aberto.',
  'support.hidden': 'O chamado está com {name} — a conversa só é vista por essa pessoa e pelo dono.',
  'support.alreadyTaken': 'O chamado já foi assumido por {name}.',
  'support.takeOwn': 'Você não pode assumir o próprio chamado.',
  'support.ledBy': 'O chamado está com {name}.',
  'support.passRights': 'Só o responsável pelo chamado ou o dono pode transferi-lo.',
  'support.passTarget': 'Só dá para transferir para o dono ou outro administrador.',
  'support.alreadyLed': 'O chamado já está com {name}.',
  'support.passRace': 'O chamado mudou ao mesmo tempo que esta ação — atualize a tela e tente de novo.',
  'support.closeRights': 'Só o responsável pelo chamado ou o dono pode encerrá-lo.',
  // Assignee without a name (event screen counters)
  'support.assigneeFallback': 'responsável',
  // Buttons under notifications
  'support.openButton': '💬 Abrir',
  'support.takeButton': '🙋 Assumir',
  // Who replied or closed — to the participant ({role})
  'support.role.owner': 'Dono',
  'support.role.admin': 'Administrador',
  // Notifications to organizers
  'support.notice.opened': '🆘 <b>{name}</b> pede ajuda no evento {title}:\n\n{text}',
  'support.notice.added': '💬 <b>{name}</b> complementa o chamado ({title}):\n\n{text}',
  'support.notice.writes': '💬 <b>{name}</b> escreve no chamado ({title}):\n\n{text}',
  'support.notice.closedByUser': '✅ <b>{name}</b> encerrou o chamado ({title}).',
  'support.notice.taken': '🙋 <b>{name}</b> assumiu o chamado de <b>{author}</b> ({title}).',
  'support.notice.passedToYou': '↪️ <b>{name}</b> transferiu para você o chamado de <b>{author}</b> ({title}).',
  'support.notice.passed': '↪️ <b>{name}</b> transferiu o chamado de <b>{author}</b> ({title}) — agora o responsável é <b>{to}</b>.',
  'support.notice.closed': '✅ <b>{name}</b> encerrou o chamado de <b>{author}</b> ({title}).',
  'support.notice.returned': '🔄 O chamado de <b>{author}</b> ({title}) está sem responsável de novo.',
  // Notifications to the participant
  'support.user.taken': '🙋 <b>{name}</b> assumiu seu chamado no evento {title} — a resposta vai chegar aqui.',
  'support.user.reply': '💬 {role} <b>{name}</b> responde ({title}):\n\n{text}',
  'support.user.passed': '↪️ Seu chamado no evento {title} agora está com <b>{name}</b>.',
  'support.user.closed': '✅ {role} <b>{name}</b> encerrou seu chamado no evento {title}. Se a dúvida continuar, é só escrever de novo.',
  'support.user.returned': '🔄 Seu chamado no evento {title} está esperando resposta de novo.',
};
