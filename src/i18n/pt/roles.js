// Texts of src/roles.js (060): bot owner, event owner and admins (063), moving participation. {name}, {from}, {to},
// {actor}, {who} in messages — names (HTML), {title} — event title in quotes (HTML)
export default {
  // App button under the message about new rights
  'roles.openButton': '🛠 Abrir',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ Os direitos de dono do bot passaram para <b>{name}</b> pelo link da página de configuração. Seus eventos continuam com você.\n\nSe não foi você nem algo combinado, troque o ADMIN_SECRET (veja o README), abra a página de configuração e use o novo link de dono.',
  'roles.botOwner.transferred': '👑 <b>Você recebeu os direitos de dono do bot.</b> O registro do bot, todos os eventos e a transferência de direitos ficam no app: ⚙️ “Ajustes” → “Dono do bot”.',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> agora é o dono do bot.',
  // Transferring bot owner rights
  'roles.transferTarget': 'Só dá para transferir os direitos de dono para uma pessoa cadastrada.',
  'roles.alreadyOwnerSelf': 'Você já é o dono.',
  'roles.alreadyTransferred': 'Os direitos de dono já foram transferidos.',
  // Event admins
  'roles.alreadyAdmin': 'Já é administrador.',
  'roles.notAdmin': 'Não é administrador.',
  'roles.grantMember': 'Só dá para nomear um participante do evento.',
  'roles.revokeOwner': 'Não dá para tirar os direitos do dono. Primeiro, transfira os direitos de dono do evento.',
  'roles.granted': '🛠 <b>Você foi nomeado administrador do evento {title}.</b>\n\nAgora você pode gerenciá-lo: convites, restrições, sorteio, lembretes. Os pares só podem ser vistos pelo dono do evento, na área restrita.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> agora é administrador do evento {title}.',
  'roles.revoked': 'Seus direitos de administrador do evento {title} foram removidos. Se você participa dele, continua jogando normalmente.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> não é mais administrador do evento {title}.',
  // Event ownership
  'roles.owner.already': 'Já é o dono.',
  'roles.owner.target': 'Só dá para transferir os direitos de dono para um participante ou administrador do evento.',
  'roles.owner.alreadyPassed': 'Os direitos de dono já foram transferidos.',
  'roles.owner.toNew': '👑 <b>Agora você é o dono do evento {title}.</b> Você nomeia administradores, abre a área restrita, zera e exclui o evento — tudo no app.',
  'roles.owner.toPrev': 'ℹ️ Os direitos de dono do evento {title} passaram para <b>{who}</b>. Você continua como administrador.',
  'roles.owner.notice': 'ℹ️ Agora o dono do evento {title} é <b>{who}</b>.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Escolha duas contas diferentes.',
  'roles.transfer.staffTarget': 'Não dá para transferir a participação para a conta do dono ou de um administrador.',
  'roles.transfer.noOld': 'Conta antiga não encontrada.',
  'roles.transfer.unregistered': 'A nova conta precisa concluir o cadastro (enviar o nome ao bot).',
  'roles.transfer.inDraw': 'A nova conta já está no sorteio do evento “{title}” — escolha outra conta.',
  'roles.transfer.toNew': '🔁 O dono do bot transferiu para esta conta sua participação no “Amigo Secreto”: cartas, presenteados, conversas e o histórico de eventos foram mantidos.',
  'roles.transfer.toOld': '🔁 Sua participação no “Amigo Secreto” foi transferida para a conta <b>{to}</b>. Se você não pediu a transferência, fale com o dono do bot.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> transferiu a participação de <b>{from}</b> para a conta <b>{to}</b>.',
  // Log: new owner; transfer "old account → new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
