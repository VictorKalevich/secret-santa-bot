// Texts of src/api.js (060): check pipeline and action handlers. {owner.nom}, {owner.dat} — "o dono" or
// "o dono do bot" (ownerWord); {word} — confirmation word of the action.
export default {
  'api.badInitData': 'Não foi possível verificar o acesso. Abra o app de novo pela conversa com o bot.',
  'api.unknownAction': 'Ação desconhecida',
  'api.noEvent': 'Evento não encontrado.',
  'api.chooseRoom': 'Escolha uma sala.',
  // What is not allowed in a finished event (field finished of the action table)
  'api.closed': 'O evento foi encerrado — não dá mais para alterá-lo (dá para ver, revelar e excluir).',
  'api.letterClosed': 'O evento foi encerrado: a carta agora é só para leitura.',
  'api.markClosed': 'O evento foi encerrado: a marcação agora é só para leitura.',
  'api.maskClosed': 'O evento foi encerrado: não dá mais para trocar a máscara.',
  // Confirmation word (field confirm): refusal without the word
  'api.confirm.delete': 'Para excluir, digite a palavra {word}.',
  'api.confirm.leave': 'Para sair, digite a palavra {word}.',
  'api.confirm.cancel': 'Para cancelar, digite a palavra {word}.',
  'api.confirm.reset': 'Para zerar o evento, digite a palavra {word}.',
  'api.confirm.vault': 'Para entrar na área restrita, digite a palavra {word}.',
  // Refusal to a non-owner (field owner): api.owner.* — with the room ownerWord, api.botOwner.* — always the bot owner
  'api.owner.roles': 'Só {owner.nom} pode nomear e remover administradores.',
  'api.owner.vault': 'A área restrita é só para {owner.dat}.',
  'api.owner.swap': 'Só {owner.nom} pode trocar presenteados depois do sorteio.',
  'api.owner.transfer': 'Só {owner.nom} pode transferir os direitos de dono.',
  'api.owner.insert': 'Só {owner.nom} pode incluir alguém no sorteio depois de feito.',
  'api.owner.fixed': 'Só {owner.nom} pode fixar pares.',
  'api.owner.forceCancel': 'Só {owner.nom} pode forçar o cancelamento do sorteio.',
  'api.owner.eventDelete': 'Só {owner.nom} pode excluir o evento.',
  'api.owner.reset': 'Só {owner.nom} pode zerar o evento.',
  'api.botOwner.transfer': 'Só o dono do bot pode transferir a participação para uma nova conta.',
  'api.botOwner.companyDelete': 'Só o dono do bot pode excluir a sala.',
  'api.botOnly': 'Só para o dono do bot.',
  // Handlers
  'api.nameRule': 'O nome deve ter de 1 a 40 caracteres',
  // 061: language choice — code not in the bot language list
  'api.lang.unknown': 'Esse idioma não existe.',
  'api.templateNotFound': 'Modelo não encontrado.',
  'api.memberNotFound': 'Participante não encontrado',
  'api.renameAdmin': 'Só {owner.nom} pode renomear um administrador.',
  'api.renameSelfOnly': 'Essa pessoa muda o próprio nome: “Perfil” → “✏️ Mudar nome”.',
  'api.ownerNotTransferred': 'A conta do dono não é transferida: o dono recupera o acesso por um novo link de dono (troque o ADMIN_SECRET → página /setup).',
  'api.removeSelf': 'Não dá para se remover — desative “Eu participo”.',
  'api.removeOwner': 'O dono não pode ser removido do evento. Antes, ele precisa transferir os direitos de dono.',
  'api.removeAdmin': 'Só {owner.nom} pode remover um administrador.',
  'api.drawDone': 'O sorteio já foi feito.',
  'api.chooseOtherEvent': 'Escolha outro evento.',
  'api.inviteFinished': 'O evento foi encerrado — não dá para convidar para ele.',
};
