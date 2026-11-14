// Общий сценарий замеров жеребьёвки: «семьи-пары + прошлый год, кольцевая» (как tests/draw.test.mjs:393, для любого n)
export function scenario(n) {
  const ids = Array.from({ length: n }, (_, i) => 1000000 + i * 7 + 1); // числа, похожие на id Telegram
  const families = [];
  for (let i = 0; i + 1 < n; i += 2) families.push({ giver: ids[i], receiver: ids[i + 1] }, { giver: ids[i + 1], receiver: ids[i] });
  const history = ids.map((a, i) => ({ giver: a, receiver: ids[(i + 1) % n] }));
  return { ids, families, history };
}

// Тот же генератор с зерном, что в tests/draw.test.mjs и в эталоне жеребьёвки
export { seeded } from '../support/draw-cases.mjs';
