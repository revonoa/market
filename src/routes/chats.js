const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// 채팅 시작 (구매자 → 판매자). 이미 있으면 기존 방 반환.
// body: { sellerId, itemId? }  ← itemId는 화면 리다이렉트용으로만 사용
router.post('/start', authRequired, async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const sellerId = parseInt(req.body.sellerId || req.query.sellerId, 10);
    const itemId = req.body.itemId || req.query.itemId; // optional

    if (!sellerId || sellerId === buyerId) {
      const isForm = (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
      if (isForm) return res.redirect(itemId ? `/items/${itemId}` : '/');
      return res.status(400).json({ message: 'Invalid seller' });
    }

    // 기존 방 찾기 (두 사람 모두 참가자인 방)
    const [found] = await pool.query(
      `SELECT c.id
         FROM chats c
         JOIN chat_participants p1 ON p1.chat_id=c.id AND p1.user_id=?
         JOIN chat_participants p2 ON p2.chat_id=c.id AND p2.user_id=?
        LIMIT 1`,
      [buyerId, sellerId]
    );

    let chatId;
    if (found.length) {
      chatId = found[0].id;
    } else {
      // 새 방 만들기
      const [c] = await pool.query('INSERT INTO chats () VALUES ()');
      chatId = c.insertId;
      await pool.query('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)',
        [chatId, buyerId, chatId, sellerId]);
    }

    const isForm = (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
    if (isForm) return res.redirect(`/chats/${chatId}`); // ✅ 폼이면 바로 채팅방으로
    res.json({ chatId });
  } catch (e) { next(e); }
});

// 내가 참여중인 채팅 목록 (상대 닉네임 + 최근 메시지)
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
  `SELECT c.id AS chatId,
          u.nickname AS otherNickname,
          u.id AS otherId,
          (SELECT m.content FROM messages m WHERE m.chat_id=c.id ORDER BY m.id DESC LIMIT 1) AS lastMessage,
          (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id ORDER BY m.id DESC LIMIT 1) AS lastAt
     FROM chats c
     JOIN chat_participants me ON me.chat_id=c.id AND me.user_id=?
     JOIN chat_participants other ON other.chat_id=c.id AND other.user_id<>?
     JOIN users u ON u.id=other.user_id
   ORDER BY (lastAt IS NULL), lastAt DESC, c.id DESC`,
  [userId, userId]
);

    res.json(rows);
  } catch (e) { next(e); }
});

// 특정 채팅 메시지 페이징 (최신부터 N개)
router.get('/:chatId/messages', authRequired, async (req, res, next) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const size = Math.min(parseInt(req.query.size || '50', 10), 100);
    // 권한 확인
    const [auth] = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id=? AND user_id=?',
      [chatId, req.user.id]
    );
    if (!auth.length) return res.status(403).json({ message: 'Forbidden' });

    const [msgs] = await pool.query(
      `SELECT m.id, m.sender_id AS senderId, u.nickname AS senderName, m.content, m.created_at AS createdAt
         FROM messages m
         JOIN users u ON u.id=m.sender_id
        WHERE m.chat_id=?
        ORDER BY m.id DESC
        LIMIT ?`,
      [chatId, size]
    );
    res.json(msgs.reverse()); // 오래된→최신 순서로 반환
  } catch (e) { next(e); }
});

module.exports = router;
