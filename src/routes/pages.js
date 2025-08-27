const express = require('express');
const pool = require('../config/db');

const router = express.Router();

const { authRequired, requireRole } = require('../middleware/auth');
//const { authRequired } = require('../middleware/auth');

// 홈: 최신 아이템 목록
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.title, i.price, i.image_url, i.status, u.nickname AS seller_nickname
         FROM items i JOIN users u ON u.id=i.seller_id
       ORDER BY i.id DESC
       LIMIT 12`
    );
    res.render('index', { items: rows });
  } catch (e) { next(e); }
});

// 회원가입/로그인 폼
router.get('/register', (req, res) => res.render('auth/register'));
router.get('/login', (req, res) => res.render('auth/login'));

// 아이템 작성 폼
router.get('/items/new', (req, res) => res.render('items/create'));

// 아이템 상세
router.get('/items/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT i.*, u.nickname AS seller_nickname FROM items i JOIN users u ON u.id=i.seller_id WHERE i.id=?',
      [req.params.id]
    );
    const item = rows[0];
    if (!item) return res.status(404).send('Not Found');
    res.render('items/detail', { item });
  } catch (e) { next(e); }
});

// 관리자: 게시물 관리 목록
router.get('/admin/items', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.title, i.price, i.status, i.created_at, u.nickname AS seller
         FROM items i JOIN users u ON u.id=i.seller_id
       ORDER BY i.id DESC
       LIMIT 100`
    );
    res.render('admin/items', { items: rows });
  } catch (e) { next(e); }
});



// 관리자: 상태 변경 (폼 → method-override 로 PATCH)
router.post('/admin/items/:id/status', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE items SET status=? WHERE id=?', [status, req.params.id]);
    res.redirect('/admin/items');
  } catch (e) { next(e); }
});

// 관리자: 삭제 (폼 → method-override 로 DELETE)
router.delete('/admin/items/:id', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM items WHERE id=?', [req.params.id]);
    res.redirect('/admin/items');
  } catch (e) { next(e); }
});

// 채팅 목록 페이지
router.get('/chats', authRequired, async (req, res, next) => {
  try {
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
  [req.user.id, req.user.id]
);

    res.render('chats/list', { chats: rows });
  } catch (e) { next(e); }
});

// 채팅방 페이지
router.get('/chats/:chatId', authRequired, async (req, res, next) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    // 권한 확인 & 상대 닉네임
    const [who] = await pool.query(
      `SELECT u.nickname AS otherNickname
         FROM chat_participants me
         JOIN chat_participants other ON other.chat_id=me.chat_id AND other.user_id<>?
         JOIN users u ON u.id=other.user_id
        WHERE me.chat_id=? AND me.user_id=?
        LIMIT 1`,
      [req.user.id, chatId, req.user.id]
    );
    if (!who.length) return res.status(403).send('Forbidden');
    res.render('chats/room', { chatId, otherNickname: who[0].otherNickname });
  } catch (e) { next(e); }
});

module.exports = router;
