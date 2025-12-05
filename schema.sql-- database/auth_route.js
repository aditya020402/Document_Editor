const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { signToken, verifyAuth } = require('../config/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, password required' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insert = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, passwordHash, 'user']  // normal users register as 'user'
    );
    const user = insert.rows[0];

    // Option: auto-login
    const token = signToken(user);

    res.json({
      user,
      token,
    });
  } catch (err) {
    console.error('Register error', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const uRes = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );
    if (uRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = uRes.rows[0];

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /api/auth/me
router.get('/me', verifyAuth, async (req, res) => {
  try {
    const uRes = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (uRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: uRes.rows[0] });
  } catch (err) {
    console.error('Me error', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});


// ========================================
// REFRESH - Get new access token
// ========================================
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists and not revoked
    const tokenRes = await pool.query(
      `SELECT * FROM refresh_tokens 
       WHERE token = $1 AND user_id = $2 AND revoked = FALSE AND expires_at > NOW()`,
      [refreshToken, payload.userId]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token expired or revoked' });
    }

    // Get user
    const userRes = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = signToken(user);

    // Revoke old refresh token
    await pool.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1',
      [refreshToken]
    );

    // Store new refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, newRefreshToken, expiresAt]
    );

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });

    console.log(`✅ Token refreshed for user ${user.id}`);
  } catch (err) {
    console.error('Refresh error', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ========================================
// LOGOUT - Revoke refresh token
// ========================================
router.post('/logout', verifyAuth, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await pool.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1 AND user_id = $2',
        [refreshToken, req.user.id]
      );
    }

    res.json({ success: true });
    console.log(`✅ User ${req.user.id} logged out`);
  } catch (err) {
    console.error('Logout error', err);
    res.status(500).json({ error: 'Failed to logout' });
  }
});


module.exports = router;
