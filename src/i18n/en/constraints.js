// Texts of src/constraints.js (061, English): exclusions and the owner's fixed pairs
export default {
  'constraints.twoPeople': 'Choose two different people',
  // Exclusions
  'constraints.exclusionsFrozen': 'Exclusions can’t be changed after the draw: otherwise the pairs could be figured out from participant replacements. To change exclusions, cancel the draw (while no one has opened their giftee).',
  'constraints.exclusionMembers': 'Exclusions can only be set between event participants.',
  // Fixed pairs (014, 031); {santa} and {ward} — a fixed pair, {name} — a participant
  'constraints.fixedFrozen': 'Fixed pairs can’t be changed after the draw. To change them, cancel the draw.',
  'constraints.fixedMembers': 'A pair can only be fixed between event participants.',
  'constraints.ringOneWay': 'With a ring draw, a pair can be fixed in one direction only.',
  'constraints.ringReverse': 'With a ring draw, a pair can be fixed in one direction only: “{santa}” already gives to “{ward}”.',
  'constraints.santaTaken': '“{name}” already has a fixed giftee — remove that pair first.',
  'constraints.wardTaken': '“{name}” already has a fixed Santa — remove that pair first.',
  'constraints.fixedChanged': 'Fixed pairs have just changed — refresh the screen and try again.',
};
