// Texts of src/events.js (060): creation, finishing, deletion, reset, invitations, reveal, reminders,
// announcements, event parameters
export default {
  'events.titleRule': 'O nome do evento deve ter de 1 a 80 caracteres.',
  // Creating (063): who can and the limit; {limit} — the limit for 12 months, {date} — when a slot frees up
  'events.createRight': 'Neste bot, podem criar eventos o dono do bot e as pessoas a quem ele permitiu.',
  'events.limit': 'Em 12 meses dá para criar no máximo {limit} eventos. O próximo — a partir de {date}.',
  // Shared app button under a message about the event (also in src/pairs.js)
  'events.openButton': '🎁 Abrir',
  // Finishing
  'events.alreadyFinished': 'O evento já foi encerrado.',
  'events.finished': '🏁 <b>O evento {title} foi encerrado.</b> Obrigado por jogar!\n\nA carta ao Papai Noel agora é só para leitura. A conversa fica aberta por mais 7 dias (até {until}) e depois fica só para leitura. O histórico do evento fica salvo no app.',
  'events.finishedButton': '📚 Abrir',
  // Deletion and full reset
  'events.deleted': '🗑 O evento {title} foi excluído pelo dono, junto com as cartas e as conversas.',
  'events.alreadyDeleted': 'O evento já foi excluído.',
  'events.reset': '🎄 O dono recomeçou o evento {title} do zero. Os dados anteriores foram apagados. Para participar, peça um novo link de convite.',
  'events.resetRace': 'O evento já foi zerado ou mudou ao mesmo tempo — atualize a tela.',
  // Inviting participants of another event
  'events.registrationClosed': 'As inscrições estão encerradas — abra-as para convidar.',
  'events.setupFirst': 'Primeiro, abra a página de configuração /setup (veja o README).',
  'events.invite': '📨 <b>Convite para o evento {title}</b> — Amigo Secreto.\nToque no botão para participar.',
  'events.inviteButton': '🎄 Participar',
  'events.inviteAgain': 'Os convites já foram enviados — dá para repetir daqui a um minuto.',
  // Reveal: {name} — Santa name
  'events.alreadyRevealed': 'O segredo já foi revelado.',
  'events.revealed': '🎅 <b>Segredo revelado!</b>\n\nNo evento {title}, seu Papai Noel secreto é <b>{name}</b>. Boas festas! 🎄',
  // Reminders: empty letter (with and without a deadline) and to Santas (with and without the exchange date)
  'events.remindAgain': 'O lembrete já foi enviado — dá para repetir daqui a um minuto.',
  'events.remindUnfilled': '⏰ Lembrete: sua carta ao Papai Noel no evento {title} ainda está vazia. Preencha para facilitar a escolha do presente.',
  'events.remindUnfilledBy': '⏰ Lembrete: sua carta ao Papai Noel no evento {title} ainda está vazia. Preencha até <b>{date}</b> para facilitar a escolha do presente.',
  'events.remindSantas': '🎁 Lembrete para o Papai Noel ({title}): o presente do seu presenteado já está pronto?\nQuando estiver, marque na aba “Presenteado”.',
  'events.remindSantasDated': '🎁 Lembrete para o Papai Noel ({title}): o presente do seu presenteado já está pronto? Troca de presentes: <b>{date}</b>.\nQuando estiver, marque na aba “Presenteado”.',
  // Announcements (007)
  'events.announceFinished': 'O evento foi encerrado — não dá mais para enviar avisos nele.',
  'events.announceEmpty': 'Escreva o texto do aviso.',
  'events.announcement': '📣 <b>Aviso · {title}</b>\n\n{text}',
  'events.announcementButton': '📌 Abrir evento',
  'events.announceAgain': 'Este aviso já foi enviado.',
  // Parameters
  'events.ringAfterDraw': 'Depois do sorteio, não dá para mudar o sorteio em círculo.',
  // Log details
  'events.auditText.fromTemplate': 'com base em “{title}”',
  'events.auditText.deleted': '“{title}”, participantes: {n}',
  'events.auditText.reset': 'participantes removidos: {n}',
  'events.auditText.invited': 'de “{title}”, convidados: {n}',
  'events.auditText.pairs': 'pares: {n}',
  'events.auditText.received': 'receberam: {n}',
  'events.auditText.settings': 'configurações',
  'events.auditText.ring': 'sorteio em círculo: {state}',
  'events.auditText.avoidPrevious': 'não repetir pares anteriores: {state}',
  'events.auditText.on': 'ativado',
  'events.auditText.off': 'desativado',
  'events.auditText.registrationOpen': 'abertas',
  'events.auditText.registrationClosed': 'encerradas',
};
