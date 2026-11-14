// 024: кнопки приложения блокируются на время запроса — у каждого вызова busy() есть кнопка (или список кнопок).
// busy(null, …) оставлял кнопку доступной: второе нажатие уходило вторым запросом (research R5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP, where } from './support/app-source.mjs';

// Нарушения в тексте склейки: [номер строки, строка] — вызов busy без кнопки
export function busyWithoutButton(text) {
  const found = [];
  text.split('\n').forEach((line, i) => {
    if (/\bbusy\(\s*(null|undefined|\))/.test(line)) found.push([i + 1, line.trim()]);
  });
  return found;
}

test('у каждого вызова busy() есть кнопка: на время запроса она недоступна', () => {
  const found = busyWithoutButton(APP).map(([n, line]) => `${where(n)}: ${line.slice(0, 140)}`);
  assert.deepEqual(found, [], 'передай в busy() нажатую кнопку или список кнопок (e.currentTarget, все кнопки ряда)');
});

test('от противного: busy без кнопки находится', () => {
  const sample = [
    "h('button', { onclick: () => busy(null, async () => { await api('x'); }) }, '✕')",
    'busy(undefined, go);',
    'busy();',
    'busy(btn, go); busy([a, b], go); busy(e.currentTarget, go);',
  ].join('\n');
  assert.deepEqual(busyWithoutButton(sample).map(([n]) => n), [1, 2, 3]);
});
