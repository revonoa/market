const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// 쿠키 파서 (socket.request.headers.cookie에서 토큰 꺼냄)
function parseCookie(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(kv => {
    const idx = kv.indexOf('=');
    if (idx > -1) out[kv.slice(0, idx).trim()] = decodeURIComponent(kv.slice(idx + 1));
  });
  return out;
}

function authFromCookie(socket, next) {
  try {
    const cookies = parseCookie(socket.request.headers.cookie || '');
    const token = cookies['access_token'];
    if (!token) return next(new Error('unauthorized'));
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.user = payload; // { id, role, nickname }
    next();
  } catch (e) {
    next(new Error('unauthorized'));
  }
}

function initChatSocket(io) {
  const nsp = io.of('/chat');
  nsp.use(authFromCookie);

  nsp.on('connection', (socket) => {
    // join: {chatId}
    socket.on('join', async ({ chatId }) => {
      if (!chatId) return;
      // 권한 확인: 참여자인지 확인
      const [rows] = await pool.query(
        'SELECT 1 FROM chat_participants WHERE chat_id=? AND user_id=?',
        [chatId, socket.user.id]
      );
      if (!rows.length) return; // 무시
      socket.join(`chat:${chatId}`);
    });

    // message:send {chatId, content}
    socket.on('message:send', async ({ chatId, content }) => {
      if (!chatId || !content) return;
      // 참여자 확인
      const [rows] = await pool.query(
        'SELECT 1 FROM chat_participants WHERE chat_id=? AND user_id=?',
        [chatId, socket.user.id]
      );
      if (!rows.length) return;

      // DB 저장
      const [r] = await pool.query(
        'INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)',
        [chatId, socket.user.id, content]
      );
      const msg = {
        id: r.insertId,
        chatId,
        senderId: socket.user.id,
        senderName: socket.user.nickname,
        content,
        createdAt: new Date().toISOString()
      };
      // 같은 방에 브로드캐스트
    //   nsp.to(`chat:${chatId}`).emit('message:new', msg);
    socket.to(`chat:${chatId}`).emit('message:new', msg);
    });

    // typing {chatId, isTyping}
    socket.on('typing', ({ chatId, isTyping }) => {
      if (!chatId) return;
      nsp.to(`chat:${chatId}`).emit('typing', { userId: socket.user.id, isTyping: !!isTyping });
    });
  });
}

module.exports = { initChatSocket };
