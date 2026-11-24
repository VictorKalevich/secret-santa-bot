// Texts of src/constraints.js (060): exclusions and fixed pairs of the owner
export default {
  'constraints.twoPeople': 'Escolha duas pessoas diferentes',
  // Exclusions
  'constraints.exclusionsFrozen': 'Depois do sorteio, as restrições não mudam: senão, pelas trocas de participantes, daria para descobrir os pares. Para mudar as restrições, cancele o sorteio (enquanto ninguém tiver visto o presenteado).',
  'constraints.exclusionMembers': 'Só dá para criar uma restrição entre participantes do evento.',
  // Fixed pairs (014, 031); {santa} and {ward} — the fixed pair, {name} — a participant
  'constraints.fixedFrozen': 'Depois do sorteio, os pares fixos não mudam. Para mudá-los, cancele o sorteio.',
  'constraints.fixedMembers': 'Só dá para fixar um par entre participantes do evento.',
  'constraints.ringOneWay': 'No sorteio em círculo, um par só pode ser fixado em um sentido.',
  'constraints.ringReverse': 'No sorteio em círculo, um par só pode ser fixado em um sentido: “{santa}” já presenteia “{ward}”.',
  'constraints.santaTaken': '“{name}” já tem um presenteado fixo — remova aquele par primeiro.',
  'constraints.wardTaken': 'O Papai Noel de “{name}” já está fixado — remova aquele par primeiro.',
  'constraints.fixedChanged': 'Os pares fixos acabaram de mudar — atualize a tela e tente de novo.',
};
