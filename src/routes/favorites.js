const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// 찜 토글
router.post('/:itemId/toggle', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.itemId, 10);

    const [own] = await pool.query('SELECT seller_id FROM items WHERE id=?', [itemId]);
    if (!own.length) return res.status(404).json({ message: 'Item not found' });
    if (own[0].seller_id === userId) {
      // HTML 폼인 경우 상세로 리다이렉트 (메시지는 페이지에 안내문으로 이미 처리)
      const isForm = (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
      if (isForm) return res.redirect(`/items/${itemId}`);
      return res.status(400).json({ message: 'Cannot favorite your own item' });
    }

    const [has] = await pool.query('SELECT 1 FROM favorites WHERE user_id=? AND item_id=?', [userId, itemId]);
    let favored;
    if (has.length) {
      await pool.query('DELETE FROM favorites WHERE user_id=? AND item_id=?', [userId, itemId]);
      favored = false;
    } else {
      await pool.query('INSERT INTO favorites (user_id, item_id) VALUES (?, ?)', [userId, itemId]);
      favored = true;
    }

    // 폼 제출이면 상세로 리다이렉트, 아니면 JSON
    const isForm = (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
    if (isForm) return res.redirect(`/items/${itemId}`);
    return res.json({ favored });
  } catch (e) { next(e); }
});


// 내 찜 목록
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT i.id, i.title, i.price, i.image_url, i.status, u.nickname AS seller_nickname
         FROM favorites f
         JOIN items i ON i.id=f.item_id
         JOIN users u ON u.id=i.seller_id
        WHERE f.user_id=?
        ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
