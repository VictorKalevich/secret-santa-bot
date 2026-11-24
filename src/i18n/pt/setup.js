// Texts of src/setup.js (060): the /setup page, commands, menu button and bot descriptions.
// Paragraph markup (<code>, <b>) is part of the text
export default {
  'setup.title': 'Configuração',
  // Key form
  'setup.form.label': 'Chave de configuração (valor do segredo ADMIN_SECRET)',
  'setup.form.clear': 'Limpar o campo “Chave de configuração”',
  'setup.form.submit': 'Configurar o bot',
  'setup.noSecret.title': 'É preciso o ADMIN_SECRET',
  'setup.noSecret.text': 'Defina o segredo ADMIN_SECRET com pelo menos 8 caracteres (veja as instruções).',
  'setup.start.title': '🎄 Configuração do bot',
  'setup.start.text': 'Digite a chave de configuração — a que você definiu com o comando\n<code>npx wrangler secret put ADMIN_SECRET</code>.',
  'setup.badKey.title': 'Chave incorreta',
  'setup.badKey.text': 'A chave não confere. Verifique o valor do ADMIN_SECRET.',
  // The owner link has already been used
  'setup.locked.title': '🔒 Página bloqueada',
  'setup.locked.used': 'O link de dono já foi usado, por isso a página de configuração não o mostra mais e não altera as configurações do bot.',
  'setup.locked.unlock': 'Para desbloquear (por exemplo, se o link vazou ou se é preciso retomar os direitos de dono), troque a chave:',
  'setup.locked.then': 'Depois abra esta página de novo e digite a nova chave — vai aparecer um novo link de dono, e o antigo deixa de funcionar.',
  // Setup steps
  'setup.step.token': 'Token do bot',
  'setup.step.webhook': 'Webhook',
  'setup.step.commands': 'Comandos',
  'setup.step.menuButton': 'Botão do app',
  // 061: commands and descriptions in the other languages are sent in parts along with people's requests
  'setup.profileLater': 'o bot vai enviar os outros idiomas ao Telegram nos próximos minutos',
  'setup.failed': 'Não deu certo',
  // Commands, menu button and bot descriptions in Telegram
  'setup.command.start': 'Menu principal e meus eventos',
  'setup.command.language': 'Idioma do bot',
  'setup.command.cancel': 'Cancelar a digitação',
  'setup.menuButton': '🎁 Amigo Secreto',
  'setup.description': '🎄 Bot fechado para jogar Amigo Secreto: cartas ao Papai Noel, sorteio com restrições, perguntas anônimas. Entrada pelo link de convite de um evento.',
  'setup.shortDescription': '🎄 Amigo Secreto para amigos, família e colegas',
  // Result
  'setup.done.ok': '✅ Bot configurado',
  'setup.done.problems': '⚠️ Há problemas',
  'setup.done.linkTitle': '1. Link de dono',
  'setup.done.linkText': 'Abra-o no Telegram — o bot vai tornar você o <b>dono do bot</b>. O dono cria eventos, nomeia e remove\nadministradores no app (tela inicial → “Dono e administradores”) e pode abrir a área restrita dos pares.',
  'setup.done.linkWarn': '⚠️ O link <b>funciona uma única vez</b>: depois de usá-lo, esta página fica bloqueada até você trocar o\nADMIN_SECRET. Não encaminhe o link para ninguém — quem abrir primeiro vira o dono. Se isso acontecer, troque o ADMIN_SECRET,\nabra a página de novo e use o novo link. Enquanto o link não for usado, dá para abrir a página de novo.',
  'setup.done.eventTitle': '2. Crie um evento',
  'setup.done.eventText': 'Na conversa com o bot, toque em “🎁 Amigo Secreto” → “🎄 Criar”. Cada evento tem seu próprio link de convite — dá para\ncopiá-lo ou enviá-lo para um chat direto do app (aba “Gerenciar” do evento).',
};
