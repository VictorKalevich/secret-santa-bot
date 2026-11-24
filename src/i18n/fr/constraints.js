// Texts of src/constraints.js (060): exclusions and owner's fixed pairs
export default {
  'constraints.twoPeople': "Choisis deux personnes différentes",
  // Exclusions
  'constraints.exclusionsFrozen': "Après le tirage, les exclusions ne changent plus : sinon, on pourrait deviner les paires d'après les remplacements. Pour modifier les exclusions, annule le tirage (tant que personne n'a découvert son destinataire).",
  'constraints.exclusionMembers': "Une exclusion ne peut concerner que des participants de l'événement.",
  // Fixed pairs (014, 031); {santa} and {ward} - the fixed pair, {name} - a participant
  'constraints.fixedFrozen': "Après le tirage, les paires imposées ne changent plus. Pour les modifier, annule le tirage.",
  'constraints.fixedMembers': "Une paire ne peut être imposée qu'entre participants de l'événement.",
  'constraints.ringOneWay': "Avec le tirage en cercle, une paire ne peut être imposée que dans un sens.",
  'constraints.ringReverse': "Avec le tirage en cercle, une paire ne peut être imposée que dans un sens : « {santa} » offre déjà à « {ward} ».",
  'constraints.santaTaken': "« {name} » a déjà un destinataire imposé — retire d'abord cette paire.",
  'constraints.wardTaken': "Le Père Noël de « {name} » est déjà imposé — retire d'abord cette paire.",
  'constraints.fixedChanged': "Les paires imposées viennent de changer — actualise l'écran et réessaie.",
};
