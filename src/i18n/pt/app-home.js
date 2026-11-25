// Texts of app part 03-home (060): the "My events" home screen and the "New event" sheet (063)
export default {
  // Leaving an event or a tab (058): asks only about what will not save by itself
  'app.home.unsaved': 'A carta não foi salva. Sair sem salvar?',
  // Error screen on an event — back to the list
  'app.home.toEvents': 'Voltar para a lista de eventos',
  // Shared labels (also on the event screen)
  'app.home.you': '  (você)',
  // Event state: list labels; "in progress" — also the "Status" row on "Info"
  'app.home.finished': 'encerrado',
  'app.home.active': 'em andamento',
  'app.home.notMember': 'você não participa',
  // Home screen (063): ongoing and finished events; {n} — number of finished ones
  'app.home.greet': 'Oi, {name}!',
  'app.home.going': 'Em andamento',
  'app.home.done': 'Encerrados · {n}',
  'app.home.empty.create': 'Ainda não há eventos. Crie o seu — botão abaixo — ou peça o link de convite de um evento.',
  'app.home.empty.join': 'Você ainda não participa de nenhum evento. Peça o link de convite de um evento.',
  // The bot owner in someone else's event (063): notice above "Info" and "Manage"
  'app.home.guest': 'Você está aqui como dono do bot: não aparece nas listas do evento e não recebe as mensagens para os administradores. Suas alterações ficam no registro do evento.',
  // New event (007: from a template; 063: the creator is the owner, limit); {year} — next year
  'app.home.create.button': '🎄 Criar evento',
  'app.home.create.title': 'Novo evento',
  'app.home.create.hint': 'Escreva o nome do evento',
  'app.home.create.name': 'Nome do evento',
  'app.home.create.placeholder': 'Ano Novo {year} — família',
  'app.home.create.noTemplate': 'Sem modelo — do zero',
  'app.home.create.fromTemplate': 'Com base em: {title}',
  'app.home.create.invite': 'Convidar os participantes do modelo',
  'app.home.create.templateHint': 'Do modelo são copiados o valor do presente, o local, as observações, as regras do sorteio e as restrições. As datas, não.',
  'app.home.create.participate': 'Eu também participo',
  // Limit (063): {n} — how many more; {limit} — the limit for 12 months, {date} — when a slot frees up
  'app.home.create.left': {
    one: 'Você ainda pode criar {n} evento em 12 meses.',
    other: 'Você ainda pode criar {n} eventos em 12 meses.',
  },
  'app.home.create.full': 'Em 12 meses dá para criar no máximo {limit} eventos. O próximo — a partir de {date}.',
  'app.home.create.done': '🎄 Evento criado',
  'app.home.create.doneInvited': '🎄 Evento criado, convites: {count}',
  'app.home.create.doneInviteError': '🎄 Evento criado. {error}',
};
