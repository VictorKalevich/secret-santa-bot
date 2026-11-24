// Texts of src/pairs.js (060): draw, inserting, removing, cancelling, swapping giftees
export default {
  // Reasons the draw is impossible (pairs.reason.<problem type of draw.js>); {name} — participant name
  'pairs.reason.too_few': 'São necessários pelo menos 2 participantes.',
  'pairs.reason.ring_too_few': 'O sorteio em círculo precisa de pelo menos 3 participantes — ou desative o sorteio em círculo nas configurações.',
  'pairs.reason.ring_impossible': 'Parece que, com essas restrições, não dá para evitar pares mútuos. Tente de novo; se não der, remova algumas restrições ou desative o sorteio em círculo.',
  'pairs.reason.no_receivers': '{name} não pode presentear ninguém — confira as restrições.',
  'pairs.reason.no_givers': 'Ninguém pode presentear {name} — confira as restrições.',
  'pairs.reason.search_exhausted': 'Não foi possível encontrar uma distribuição rapidamente — tente de novo. Se não der, remova algumas restrições ou desative o sorteio em círculo.',
  'pairs.reason.fixed_block': 'Os pares fixos atrapalham: com eles, não dá para distribuir todos seguindo as regras. {owner.nomCap} pode remover alguns pares fixos.',
  'pairs.reason.too_strict': 'Restrições demais: não dá para distribuir todos respeitando todas elas. Remova algumas restrições.',
  // Participant without a name in the reason
  'pairs.familiesBlock': 'As famílias atrapalham: membros da mesma família não se presenteiam, e assim não dá para distribuir todos. Desative “Considerar famílias” ou o sorteio em círculo.',
  // Draw
  'pairs.drawn': '🎄 <b>O sorteio do evento {title} foi feito!</b>\n\nAbra o app e veja a aba “Presenteado” para descobrir quem você vai presentear. Não conte para ninguém 🤫',
  'pairs.drawnButton': '🎁 Ver presenteado',
  'pairs.drawFinished': 'O evento foi encerrado.',
  'pairs.drawRace': 'Participantes, restrições ou famílias mudaram durante o sorteio — tente de novo.',
  'pairs.notDrawn': 'O sorteio não foi feito.',
  // Pairs after a change of members: to the new participant and to a Santa with a new giftee
  'pairs.inserted': '🎄 <b>Você está no jogo!</b> O sorteio do evento {title} foi feito para você — veja a aba “Presenteado” 🤫',
  'pairs.newWard': '🔄 Os participantes do evento {title} mudaram, e agora você tem um <b>novo presenteado</b>. Veja a aba “Presenteado”.',
  'pairs.lookButton': '🎁 Ver',
  // Removing and inserting a participant
  'pairs.notMember': 'Essa pessoa não participa deste evento.',
  'pairs.removeBlocked': 'Não dá para remover o participante sem violar as restrições ou o sorteio em círculo. Afrouxe as restrições.',
  'pairs.removed': 'Removeram você do evento {title}. Se foi um engano, fale com o dono ou um administrador.',
  'pairs.alreadyInDraw': 'O participante já está no sorteio.',
  'pairs.insertBlocked': 'Não dá para incluir o participante sem violar as regras: os presentes já estão prontos para todos que poderiam trocar de presenteado, ou as restrições atrapalham. Dá para cancelar o sorteio na zona de perigo e fazer de novo.',
  // Swapping giftees (048): rules without names (pairs.swapRule.<rule>), refusals and the message to Santa
  'pairs.swapRule.self': 'Um dos dois presenteia o outro: depois da troca, alguém presentearia a si mesmo.',
  'pairs.swapRule.exclusion': 'Restrições: um dos dois vai presentear alguém que, pelas restrições, não deveria.',
  'pairs.swapRule.family': 'Famílias: um dos dois vai presentear alguém da própria família.',
  'pairs.swapRule.ring': 'Sorteio em círculo: vai surgir um par mútuo — dois vão se presentear.',
  'pairs.swapRule.fixed': 'Pares fixos: a troca vai desfazer um par que você fixou.',
  'pairs.swapRule.history': 'Pares anteriores: um dos dois vai presentear a mesma pessoa do evento anterior.',
  'pairs.swapRevealed': 'O segredo já foi revelado — não dá para trocar presenteados.',
  'pairs.swapTwo': 'Escolha dois participantes diferentes.',
  'pairs.notInDraw': 'O participante não está no sorteio.',
  'pairs.swapStale': 'Os pares já mudaram — abra a troca de novo.',
  'pairs.swapSelf': 'Não dá para trocar esses dois — escolha outro par.',
  'pairs.swapRulesChanged': 'As regras do sorteio para esta troca mudaram — confira de novo.',
  'pairs.swapNotice': '🔄 O dono alterou o sorteio do evento {title}: agora você tem um <b>novo presenteado</b>. O par anterior não vale mais, e a conversa dele foi apagada. Veja a aba “Presenteado”.',
  // Cancelling the draw (007) and forced cancel (012)
  'pairs.cancelFinished': 'O evento foi encerrado — não dá para cancelar o sorteio.',
  'pairs.cancelRevealed': 'O segredo já foi revelado — não dá para cancelar o sorteio.',
  'pairs.cancelBlocked': 'Não dá para cancelar: alguém já viu o presenteado ou uma conversa já começou.',
  'pairs.cancelled': '↩️ <b>Sorteio cancelado</b> no evento {title}. Sua carta ao Papai Noel continua salva. Quando houver um novo sorteio, o bot avisa.',
  'pairs.forceCancelled': '↩️ O dono <b>cancelou o sorteio</b> no evento {title}. O par anterior não vale mais, e as conversas com o Papai Noel e com o presenteado foram apagadas. Sua carta continua salva. Quando houver um novo sorteio, o bot avisa.',
  // Log details
  'pairs.auditText.members': 'participantes: {n}',
  'pairs.auditText.changed': 'pares alterados: {n}',
  'pairs.auditText.removed': 'pares removidos: {n}',
};
