// Texts of src/roles.js (060): bot owner, admins, moving participation. {name}, {from}, {to}, {actor} in messages —
// names (HTML)
export default {
  // App button under a message about new rights (also for a new room owner)
  'roles.openButton': '🛠 Abrir',
  // Bot owner rights
  'roles.botOwner.byLink': '⚠️ Os direitos de dono do bot passaram para <b>{name}</b> pelo link da página de configuração. Você continua como administrador.\n\nSe não foi você nem algo combinado, troque o ADMIN_SECRET (veja o README), abra a página de configuração e use o novo link de dono.',
  'roles.botOwner.transferred': '👑 <b>Você recebeu os direitos de dono do bot.</b> Agora você nomeia e remove administradores — seção “Dono e administradores” na tela inicial do app.',
  'roles.botOwner.notice': 'ℹ️ <b>{name}</b> agora é o dono do bot.',
  // Transfer of owner rights (bot and room)
  'roles.transferTarget': 'Só dá para transferir os direitos de dono para uma pessoa cadastrada.',
  'roles.alreadyOwnerSelf': 'Você já é o dono.',
  'roles.alreadyTransferred': 'Os direitos de dono já foram transferidos.',
  // Admins
  'roles.alreadyAdmin': 'Já é administrador.',
  'roles.notAdmin': 'Não é administrador.',
  'roles.grantUnregistered': 'Só dá para nomear uma pessoa cadastrada.',
  'roles.revokeOwner': 'Não dá para tirar os direitos do dono. Primeiro, transfira os direitos de dono.',
  'roles.granted': '🛠 <b>O dono nomeou você administrador.</b>\n\nAgora você pode criar e gerenciar eventos: convites, restrições, sorteio, lembretes. Os pares só podem ser vistos pelo dono, na área restrita.',
  'roles.grantedNotice': 'ℹ️ <b>{name}</b> agora é administrador.',
  'roles.revoked': 'O dono removeu seus direitos de administrador. Como participante dos eventos, você continua jogando normalmente.',
  'roles.revokedNotice': 'ℹ️ <b>{name}</b> não é mais administrador.',
  // Moving participation to a new account
  'roles.transfer.twoRecords': 'Escolha duas contas diferentes.',
  'roles.transfer.staffTarget': 'Não dá para transferir a participação para a conta do dono ou de um administrador.',
  'roles.transfer.noOld': 'Conta antiga não encontrada.',
  'roles.transfer.unregistered': 'A nova conta precisa concluir o cadastro (enviar o nome ao bot).',
  'roles.transfer.inDraw': 'A nova conta já está no sorteio do evento “{title}” — escolha outra conta.',
  'roles.transfer.toNew': '🔁 O dono transferiu para esta conta sua participação no “Amigo Secreto”: cartas, presenteados, conversas e o histórico de eventos foram mantidos.',
  'roles.transfer.toOld': '🔁 Sua participação no “Amigo Secreto” foi transferida para a conta <b>{to}</b>. Se você não pediu a transferência, fale com o dono.',
  'roles.transfer.notice': '🔁 <b>{actor}</b> transferiu a participação de <b>{from}</b> para a conta <b>{to}</b>.',
  // Log: new owner; transfer "old account → new"
  'roles.audit.newOwner': '→ {name}',
  'roles.audit.accountMoved': '{from} → {to}',
};
