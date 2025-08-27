const express = require('express');
const pool = require('../config/db');
const upload = require('../config/multer');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// 목록 + 검색
router.get('/', async (req, res, next) => {
  try {
    const { q = '', status, page = 1, size = 12 } = req.query;
    const limit = Math.min(parseInt(size, 10) || 12, 50);
    const offset = (parseInt(page, 10) - 1) * limit;

    const where = [];
    const params = [];
    if (q) {
      where.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) { where.push('status = ?'); params.push(status); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT i.*, u.nickname AS seller_nickname
         FROM items i JOIN users u ON u.id=i.seller_id
       ${whereSql}
       ORDER BY i.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// 단건 조회
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT i.*, u.nickname AS seller_nickname FROM items i JOIN users u ON u.id=i.seller_id WHERE i.id=?',
      [req.params.id]
    );
    const item = rows[0];
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (e) { next(e); }
});

// 생성 (이미지 선택)
// 생성 (이미지 선택)
router.post('/', authRequired, upload.single('image'), async (req, res, next) => {
  try {
    const { title, description, price, status } = req.body;
    const sellerId = req.user.id;
    const imageUrl = req.file ? '/uploads/' + req.file.filename : null;

    const [result] = await pool.query(
      `INSERT INTO items (seller_id, title, description, price, status, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sellerId, title, description, price, status || 'on_sale', imageUrl]
    );

    const newId = result.insertId;

    //HTML 폼 요청이면 redirect (multipart/form-data 또는 x-www-form-urlencoded)
    const ct = req.headers['content-type'] || '';
    const isForm =
      ct.startsWith('multipart/form-data') ||
      ct.startsWith('application/x-www-form-urlencoded');

    if (isForm) {
      return res.redirect('/items/' + newId); // 상세 페이지로 이동
    }

    // API 호출인 경우 JSON
    return res.json({ id: newId, ok: true });
  } catch (e) { next(e); }
});



// 수정 (소유자 전용)
router.patch('/:id', authRequired, upload.single('image'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query('SELECT seller_id FROM items WHERE id=?', [id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (item.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const fields = [];
    const params = [];
    ['title','description','price','status'].forEach(k => {
      if (req.body[k] != null) { fields.push(`${k}=?`); params.push(k === 'price' ? parseInt(req.body[k],10) : req.body[k]); }
    });
    if (req.file) { fields.push('image_url=?'); params.push(`/uploads/${req.file.filename}`); }
    if (!fields.length) return res.json({ message: 'No changes' });

    params.push(id);
    await pool.query(`UPDATE items SET ${fields.join(', ')} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// 삭제 (소유자 or admin)
router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query('SELECT seller_id FROM items WHERE id=?', [id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (item.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await pool.query('DELETE FROM items WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// 상태 변경 (on_sale / reserved / sold_out)
router.patch('/:id/status', authRequired, async (req, res, next) => {
  try {
    const id = req.params.id;
    const { status } = req.body; // on_sale | reserved | sold_out
    if (!['on_sale','reserved','sold_out'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const [rows] = await pool.query('SELECT seller_id FROM items WHERE id=?', [id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (item.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await pool.query('UPDATE items SET status=? WHERE id=?', [status, id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});


module.exports = router;
