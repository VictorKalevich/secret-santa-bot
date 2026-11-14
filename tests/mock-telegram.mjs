// Имитация Telegram Bot API для локальных тестов: записывает все вызовы бота.
// Правила ответа — общие с быстрыми тестами (tests/support/telegram-rules.mjs, 016).
import http from 'node:http';
import { BLOCKED_CHAT, telegramReply } from './support/telegram-rules.mjs';

export { BLOCKED_CHAT };

// port = 0 — свободный порт выбирает система (без случайных совпадений с занятыми портами)
export function startMockTelegram(port = 0) {
  const calls = [];
  let messageId = 1;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url || '');
      const method = m ? m[2] : 'unknown';
      let params = {};
      try { params = body ? JSON.parse(body) : {}; } catch { /* ignore */ }
      calls.push({ method, params, token: m && m[1], at: Date.now() });
      const reply = telegramReply(method, params, () => messageId++);
      // connection: close (015) — без переиспользования соединений: Node закрывает простаивающее keep-alive соединение
      // через 5 с, и локальный workerd изредка отправлял запрос в уже закрытое («Network connection lost»)
      res.writeHead(reply.status, { 'content-type': 'application/json', connection: 'close' });
      res.end(JSON.stringify(reply.body));
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({
      port: server.address().port,
      calls,
      messagesTo: (chatId) => calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id === chatId),
      close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
    }));
  });
}
