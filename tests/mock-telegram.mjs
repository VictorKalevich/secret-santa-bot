// Имитация Telegram Bot API для локальных тестов: записывает все вызовы бота.
import http from 'node:http';

export const BLOCKED_CHAT = 555000555; // этот «пользователь» заблокировал бота → 403

export function startMockTelegram(port = 8790) {
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
      let result = true;
      let reply = null;
      if (method === 'getMe') result = { id: 1, is_bot: true, first_name: 'Santa', username: 'test_santa_bot' };
      if (method === 'sendMessage') {
        if (params.chat_id === BLOCKED_CHAT) reply = { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' };
        else result = { message_id: messageId++, chat: { id: params.chat_id }, text: params.text };
      }
      res.writeHead(reply ? 403 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply || { ok: true, result }));
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({
      calls,
      messagesTo: (chatId) => calls.filter((c) => c.method === 'sendMessage' && c.params.chat_id === chatId),
      close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
    }));
  });
}
