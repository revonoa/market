const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { signAccess } = require('../utils/jwt');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// 회원가입
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, nickname } = req.body;
        if (!email || !password || !nickname) {
            return res.status(400).json({ message: 'email/password/nickname required' });
        }
        const [dups] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
        if (dups.length) return res.status(409).json({ message: 'Email already exists' });

        const hash = await bcrypt.hash(password, 10);
        const [r] = await pool.query(
            'INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)',
            [email, hash, nickname]
        );

        const isForm = (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
        if (isForm) return res.redirect('/login');
        return res.status(201).json({ ok: true });

    } catch (e) { next(e); }
});

// 로그인
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
        const user = rows[0];
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

        const token = signAccess(user);

        //httpOnly 쿠키로 저장 (폼에서도 자동 전송)
        res.cookie('access_token', token, {
            httpOnly: true,
            sameSite: 'lax',
            // secure: true, // HTTPS에서만 사용할 때 켜기 (배포시 권장)
            maxAge: 60 * 60 * 1000 // 1h
        });

        const isForm = (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
    if (isForm) return res.redirect('/');

        // 페이지 라우팅을 쓰면 리다이렉트가 더 편함. 지금은 JSON 유지.
        return res.json({ accessToken: token, user: { id: user.id, nickname: user.nickname, role: user.role } });
    } catch (e) { next(e); }
});

// 로그아웃
router.post('/logout', (req, res) => {
  res.clearCookie('access_token', { sameSite: 'lax' });
  // 메인으로 리다이렉트
  const isForm = (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
  if (isForm) return res.redirect('/');
  res.json({ ok: true });
});

module.exports = router;
