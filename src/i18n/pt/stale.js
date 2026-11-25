// Texts of src/stale.js (060): warning about auto-finishing an abandoned event (056). Reasons follow the owner
// rules: empty (G), age (B); 064: only events without a date
export default {
  // {when} — finishing date, {why} — stale.why.<reason>, {keep} — stale.keep.<reason>
  'stale.warning': '⏳ <b>O evento {title} será encerrado automaticamente em {when}.</b>\n{why}\n\n{keep}',
  'stale.openButton': '⚙️ Abrir evento',
  // Why the event is considered abandoned
  'stale.why.empty': 'Ninguém entrou nele ainda, além do dono e dos administradores.',
  'stale.why.age': 'Ele não tem data da troca de presentes e foi criado há mais de sete semanas.',
  // How to keep the event
  'stale.keep.empty': 'Se ainda precisar do evento, convide participantes ou defina a data da troca de presentes: “Gerenciar” → “Configurações”.',
  'stale.keep.age': 'Se ainda precisar do evento, defina a data da troca de presentes: “Gerenciar” → “Configurações”.',
  // Detail of the finish.warn log entry (stale.auditText): {why} — stale.logged.<reason>
  'stale.auditText': '{why}; será encerrado em {when}',
  'stale.logged.date': 'a data da troca de presentes passou',
  'stale.logged.empty': 'ninguém entrou além do dono e dos administradores',
  'stale.logged.age': 'sem data da troca de presentes',
};
