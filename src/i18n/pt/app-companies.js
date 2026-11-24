// Texts of app part 04-companies (060): "Rooms" screen, "Room" sheet, owner link, bot owner rights.
// In texts for people — "sala" (room, 059)
export default {
  // Role of the person in a room row
  // "Rooms" screen
  'app.companies.title': 'Salas',
  'app.companies.empty': 'Ainda não há salas. Crie a sua — ou peça o link de convite de um evento.',
  'app.companies.emptyBotOwner': 'Ainda não há salas.',
  'app.companies.create': '🚪 Criar sala',
  'app.companies.ownLimit': 'Você pode gerenciar no máximo duas salas suas — transfira ou exclua uma delas.',
  'app.companies.botLog': '📜 Registro do bot',
  // Room row: who is the owner, how many events; buttons "✏️" and "⚙️"
  'app.companies.about': 'Dono: {owner} · eventos: {events}',
  'app.companies.aboutIdle': 'Dono: {owner} · eventos: {events} · nenhum em andamento',
  'app.companies.roomName': 'Nome da sala',
  'app.companies.ownName': 'Nome só para você',
  'app.companies.settings': 'Sala',
  // Name sheet
  'app.companies.label.field': 'Nome',
  'app.companies.label.shared': 'Este nome é visto por todas as pessoas da sala.',
  'app.companies.label.botOwner': 'Só você, o dono do bot, vê o nome da sala.',
  'app.companies.label.own': 'Só você vê este nome.',
  'app.companies.label.saved': 'Nome salvo',
  // New room
  'app.companies.new.title': 'Nova sala',
  'app.companies.new.placeholder': 'Por exemplo: Trabalho',
  'app.companies.new.done': '🚪 Sala criada',
  'app.companies.new.hintOwn': 'Você vai ser o dono da sala: cria eventos, convida pessoas e nomeia administradores. O nome será visto por todas as pessoas da sala.',
  'app.companies.new.hintBot': 'A sala tem suas próprias pessoas, eventos, famílias e administradores. Você pode gerenciá-la ou passá-la para um dono por link.',
  // "Room" sheet of the bot owner: who runs it
  'app.companies.lead.title': 'Quem gerencia',
  'app.companies.lead.you': 'Você',
  'app.companies.lead.botRun': 'A sala não tem dono próprio: quem gerencia é você.',
  'app.companies.lead.owner': 'Dono da sala: administradores, zerar e excluir eventos, área restrita dos pares.',
  'app.companies.lead.self': 'Gerenciar por conta própria',
  'app.companies.lead.selfConfirm': 'Gerenciar a sala por conta própria? “{name}” continua como administrador.',
  'app.companies.lead.selfDone': 'Agora você gerencia a sala de novo',
  // Room owner link
  'app.companies.link.title': '🔗 Link de dono da sala',
  'app.companies.link.hint': 'O link é de uso único: quem abrir primeiro vira dono da sala e pode ver os pares dos eventos dela. Envie em particular.',
  'app.companies.link.active': 'O link está ativo. Não dá para mostrá-lo de novo — mas dá para criar um novo.',
  'app.companies.link.copy': '📋 Copiar',
  'app.companies.link.shareText': '👑 Link de dono no “Amigo Secreto”: abra para gerenciar sua sala.',
  'app.companies.link.create': 'Criar link',
  'app.companies.link.renew': 'Criar novo',
  'app.companies.link.revoke': 'Revogar',
  'app.companies.link.revoked': 'Link revogado',
  // Deleting an empty room (sheet with a confirmation word)
  'app.companies.delete.section': 'Exclusão',
  'app.companies.delete.hasEvents': 'A sala tem eventos — exclua-os primeiro.',
  'app.companies.delete.button': '🗑 Excluir sala',
  'app.companies.delete.title': 'Excluir sala',
  'app.companies.delete.lines': ['as pessoas, os administradores e as famílias da sala;', 'o registro geral da sala.'],
  'app.companies.delete.keepBot': 'A sala não tem eventos. O dono e os administradores dela vão receber uma mensagem.',
  'app.companies.delete.keepOwn': 'A sala não tem eventos. Os administradores dela vão receber uma mensagem.',
  'app.companies.delete.done': 'Sala excluída',
  // Transfer bot owner rights
  'app.companies.botOwner.pass': '👑 Transferir direitos de dono do bot',
  'app.companies.botOwner.title': 'Direitos de dono do bot',
  'app.companies.botOwner.hint': 'O bot tem um único dono. Dá para transferir os direitos para alguém das salas que você gerencia.',
  'app.companies.botOwner.choose': 'Para quem transferir…',
  'app.companies.botOwner.confirm': 'Transferir os direitos de dono do bot para “{name}”? Essa pessoa vai criar e excluir salas e nomear os donos delas. Você continua como administrador das suas salas.',
  'app.companies.botOwner.done': '👑 Direitos de dono do bot transferidos',
};
