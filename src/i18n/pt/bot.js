// Texts of src/bot.js (060): chat with the bot — sign-up, menu, links, replies to chats and support requests, buttons.
// {title} — event title in quotes (HTML), {name} — name (HTML, except button labels and callback answers)
export default {
  // Name request (047: with the name from Telegram — the name and buttons)
  'bot.name.prompt': 'Qual é o seu nome? Escreva seu nome (e, se precisar, o sobrenome) — é assim que seu Papai Noel, o dono e os administradores vão ver você.',
  'bot.name.offer': 'Seu nome no jogo é <b>{name}</b>, como no Telegram. Seu Papai Noel, o dono e os administradores vão vê-lo. Quer outro? Toque em “✏️ Mudar nome” ou simplesmente escreva o nome.',
  'bot.name.ask': '✏️ Escreva seu nome (e, se precisar, o sobrenome) em uma mensagem — até 40 caracteres. É assim que seu Papai Noel, o dono e os administradores vão ver você.',
  'bot.name.saved': 'O nome já foi salvo. Dá para mudar no app: “⚙️ Ajustes” → “Perfil” → “✏️ Mudar nome”.',
  'bot.name.rule': 'Por favor, escreva o nome em texto simples (até 40 caracteres).',
  'bot.name.join': '✅ Participar como {name}',
  'bot.name.continue': '✅ Continuar como {name}',
  'bot.name.edit': '✏️ Mudar nome',
  // Greeting before the name request
  'bot.hello': '🎄 Oi! Este é o bot para jogar Amigo Secreto.',
  'bot.helloEvent': '🎄 Oi! Este é o bot para jogar Amigo Secreto: {title}.',
  'bot.niceToMeet': 'Prazer, {name}! 🎉',
  'bot.createFirstEvent': 'Crie o primeiro evento no app — lá vai aparecer o link de convite.',
  'bot.writeLetterFirst': 'Agora abra o app e escreva uma carta para seu Papai Noel secreto no evento {title}: o que você quer ganhar, do que gosta, seus tamanhos e o que não quer de jeito nenhum.',
  'bot.closedBot': '🎄 Este é um bot fechado para jogar Amigo Secreto. Para entrar, peça o link de convite de um evento.',
  'bot.cancelled': 'Cancelado.',
  // Invite link
  'bot.invite.stale': 'Este link de convite expirou. Peça um novo link.',
  'bot.invite.removed': 'Removeram você do evento {title} — não dá para voltar pelo link. Se foi um engano, fale com o dono ou um administrador.',
  'bot.invite.closed': 'As inscrições para o evento {title} estão encerradas. O dono ou um administrador pode reabri-las.',
  'bot.invite.member': '🎄 Você já participa do evento {title}.',
  'bot.invite.joined': '🎄 Você está no evento {title}! Abra o app e escreva uma carta para seu Papai Noel secreto.',
  'bot.invite.requestPending': '⏳ O pedido para participar do evento {title} já foi enviado — aguardando a resposta.',
  'bot.invite.requestSent': '⏳ Pedido para participar do evento {title} enviado. Eu aviso quando ele for analisado.',
  // Bot owner link (/setup)
  'bot.ownerLink.used': 'O link de dono já foi usado. Para obter um novo, troque o ADMIN_SECRET e abra de novo a página de configuração.',
  'bot.ownerLink.hello': '👑 Você é o dono do bot “Amigo Secreto”: cria eventos e nomeia administradores.',
  'bot.ownerLink.done': '👑 Agora você é o dono do bot: eventos e administradores ficam no app.',
  // The former owner link (051) — no longer valid (063)
  'bot.ownLink.gone': 'Este link não vale mais. Para participar, peça o link de convite de um evento.',
  // Menu
  'bot.menu.title': '🎄 <b>Amigo Secreto</b>',
  // No ongoing events: can create (063) — and cannot
  'bot.menu.noEventsCreate': 'No momento você não participa de nenhum evento em andamento. Crie seu evento no app ou peça o link de convite de um evento.',
  'bot.menu.noEvents': 'No momento você não participa de nenhum evento em andamento. Peça o link de convite de um evento.',
  'bot.menu.events': 'Seus eventos:',
  'bot.menu.event': '• {title} — {letter}, {draw}',
  'bot.menu.letterFilled': 'carta ✅',
  'bot.menu.letterEmpty': 'carta vazia ✏️',
  'bot.menu.drawAhead': 'sorteio pendente',
  'bot.menu.wardAssigned': 'presenteado definido 🎁',
  'bot.menu.awaitingInsert': 'aguardando inclusão no sorteio',
  'bot.menu.finished': '📚 Eventos encerrados: {n} — o histórico está no app.',
  'bot.menu.botOwner': '👑 Você é o dono do bot — eventos e administradores ficam no app.',
  'bot.menu.toWard': '💬 Ao presenteado · {title}',
  'bot.menu.toSanta': '💬 Ao Papai Noel · {title}',
  'bot.menu.notify': '🔔 Notificações',
  // Reply to a chat or a support request; {n} — message length limit
  'bot.reply.hint': 'Até {n} caracteres, dentro de uma hora. A conversa completa está no app (botão “💬”).\n\n/cancel — cancelar',
  'bot.reply.expired': '⌛ O tempo para responder acabou — a mensagem não foi enviada. Toque em “↩️ Responder” de novo e envie outra vez.',
  'bot.reply.tooLong': '❌ Muito longo: {n} caracteres, máximo {max}. Envie algo mais curto ou /cancel.',
  'bot.reply.failed': '❌ {error}',
  'bot.reply.toWardSent': '✅ Enviado ao presenteado em nome do “Papai Noel secreto”.',
  'bot.reply.toSantaSent': '✅ Enviado ao seu Papai Noel.',
  // "Write a message" hint
  'bot.reply.toWard': '✍️ Escreva uma mensagem para o presenteado ({title}) — vou repassá-la <b>anonimamente</b>, em nome do “Papai Noel secreto”.',
  'bot.reply.toSanta': '✍️ Escreva uma mensagem para seu Papai Noel ({title}) — vou repassá-la. Ele sabe quem você é, mas você não sabe quem ele é.',
  // Support requests to organizers (012)
  'bot.support.sent': '✅ Mensagem enviada. A resposta vai chegar aqui.',
  'bot.support.adminsOnly': '❌ Só o dono e os administradores podem responder chamados.',
  'bot.support.answered': '✅ Enviado ao participante.',
  'bot.support.notSent': '❌ {error} A mensagem não foi enviada.',
  'bot.support.participant': 'participante',
  'bot.support.ask': '✍️ Escreva uma mensagem sobre o evento ({title}) — vou repassá-la. Não conte quem é seu presenteado.',
  'bot.support.takenAnswer': '🙋 O chamado é seu',
  'bot.support.taken': '🙋 Agora você é responsável pelo chamado de <b>{name}</b> ({title}). Responda pelo botão abaixo ou no app.',
  'bot.support.someoneElse': 'outra pessoa',
  'bot.support.answer': '✍️ Escreva a resposta para <b>{name}</b> (chamado, {title}).',
  'bot.support.answerTake': '✍️ Escreva a resposta para <b>{name}</b> (chamado, {title}). Ao responder, você assume o chamado.',
  // Join requests (008)
  'bot.request.approvedAnswer': '✅ Aceito',
  'bot.request.rejectedAnswer': '❌ Recusado',
  'bot.request.approved': '✅ Pedido aceito: <b>{name}</b>, {title}.',
  'bot.request.rejected': '❌ Pedido recusado: <b>{name}</b>, {title}.',
  // Notifications about changes to the giftee letter; bot.notify.mode.<mode>
  'bot.notify.title': 'Notificações quando o presenteado altera a carta (em todos os eventos).\nAgora: <b>{mode}</b>',
  'bot.notify.saved': 'Salvo: {mode}',
  'bot.notify.mode.sound': '🔔 Com som',
  'bot.notify.mode.silent': '🔕 Sem som',
  'bot.notify.mode.off': '🚫 Não enviar',
  // 061: /language — language choice; name — language name in that language
  'bot.lang.choose': '🌐 Escolha o idioma do bot e do app:',
  'bot.lang.auto': 'Como no Telegram ({name})',
  'bot.lang.saved': 'Idioma: {name}',
};
