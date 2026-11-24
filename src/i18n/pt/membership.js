// Texts of src/membership.js (060): joining, join requests, families, "I take part", leaving
export default {
  // Families (008): rules and freezing the members while a draw is running (009)
  'membership.familyNameRule': 'O nome da família deve ter de 1 a 40 caracteres.',
  'membership.familySize': 'A família deve ter de 2 a {max} pessoas.',
  'membership.familyNotFound': 'Família não encontrada.',
  'membership.memberNotFound': 'Participante não encontrado.',
  'membership.alreadyInFamily': '{name} já está na família “{family}”.',
  'membership.familyFrozen': 'Não dá para mudar a família enquanto o evento “{title}” estiver em andamento com o sorteio feito: senão, pelas trocas de participantes, daria para descobrir os pares. Dá para mudar depois que ele for encerrado.',
  // Log: family — name and members, "I take part"
  'membership.audit.familySave': '“{name}”: {people}',
  'membership.audit.familyDelete': '“{name}”',
  'membership.audit.isParticipant': 'participa',
  'membership.audit.notParticipant': 'não participa',
  'membership.afterDraw': 'Depois do sorteio, não dá. Peça para {owner.gen} incluir você.',
  // Participant leaving (035)
  'membership.leaveAfterDraw': 'O sorteio já foi feito. Para sair, fale com o dono ou os administradores.',
  'membership.leaveFinished': 'O evento foi encerrado — não dá mais para sair dele.',
  'membership.leaveNotice': '🚪 <b>{name}</b> saiu do evento {title}.',
  'membership.openEventButton': '🛠 Abrir evento',
  // Letting removed people back (010)
  'membership.notRemoved': 'Essa pessoa não está entre os removidos.',
  // Joining and join requests (008)
  'membership.joinedNotice': '👋 <b>{name}</b> entrou no evento {title}',
  'membership.request': '🙋 <b>{name}</b> quer participar do evento {title}.',
  'membership.requestWithUsername': '🙋 <b>{name}</b> (@{username}) quer participar do evento {title}.',
  'membership.acceptButton': '✅ Aceitar',
  'membership.rejectButton': '❌ Recusar',
  'membership.requestNotFound': 'Pedido não encontrado.',
  'membership.requestDecided': 'O pedido já foi analisado.',
  'membership.approveFinished': 'O evento foi encerrado — não dá mais para aceitar ninguém nele.',
  'membership.approveClosed': 'As inscrições para o evento “{title}” estão encerradas — abra-as para aceitar o pedido.',
  // Decision on a request: to the participant and to the other admins
  'membership.approvedAfterDraw': '🎉 Pedido aprovado — você está no evento {title}! O sorteio já foi feito — {owner.nom} vai incluir você, e o bot vai avisar. Enquanto isso, escreva sua carta ao Papai Noel.',
  'membership.approved': '🎉 Pedido aprovado — você está no evento {title}! Abra o app e escreva uma carta para seu Papai Noel secreto.',
  'membership.requestRejected': 'O pedido para participar do evento {title} foi recusado. Se foi um engano, fale com o dono ou um administrador.',
  'membership.approvedBy': '✅ <b>{by}</b> aceitou o pedido de <b>{name}</b> para participar do evento {title}.',
  'membership.rejectedBy': '❌ <b>{by}</b> recusou o pedido de <b>{name}</b> para participar do evento {title}.',
};
