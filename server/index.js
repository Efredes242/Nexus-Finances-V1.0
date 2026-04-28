import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query, get, run } from './db.js';
import multer from 'multer';
import { GoogleGenAI, Type } from "@google/genai";
import * as xlsx from 'xlsx';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_me';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '651658412071-nd5ch923bksf3kdrad0un4n0gcencf1t.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

// Google Auth COOP Fix
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- Auth Endpoints ---

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        must_change_password: !!user.must_change_password,
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register (Public)
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    // Create user with default role 'user' and NO forced password change
    await run('INSERT INTO users (id, username, password, role, must_change_password) VALUES (?, ?, ?, ?, 0)',
      [id, username, hashedPassword, 'user']);

    // Auto-login after register
    const token = jwt.sign({ id, username, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: {
        id,
        username,
        role: 'user',
        must_change_password: false,
        firstName: null,
        lastName: null,
        birthDate: null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if any users exist (Public - for initial setup)
app.get('/api/has-users', async (req, res) => {
  try {
    const result = await get('SELECT COUNT(*) as count FROM users');
    res.json({ hasUsers: (result.count || 0) > 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Google Login
// Google Login
app.post('/api/auth/google', async (req, res) => {
  const { credential, accessToken } = req.body;
  console.log('[GOOGLE AUTH] Request received:', { hasCredential: !!credential, hasAccessToken: !!accessToken });

  if (!credential && !accessToken) {
    console.log('[GOOGLE AUTH] ERROR: No credential or accessToken');
    return res.status(400).json({ error: 'Credential or Access Token required' });
  }

  try {
    let email, name, sub, picture;

    if (credential) {
      console.log('[GOOGLE AUTH] Verifying credential token...');
      // Verify ID Token (Standard <GoogleLogin> component)
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        console.log('[GOOGLE AUTH] ERROR: No payload from token');
        return res.status(400).json({ error: 'Invalid token' });
      }

      email = payload.email;
      sub = payload.sub; // unique google id
      picture = payload.picture;
      console.log('[GOOGLE AUTH] Token verified:', { email, sub });
    } else if (accessToken) {
      console.log('[GOOGLE AUTH] Verifying access token...');
      // Verify Access Token (Custom useGoogleLogin hook)
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!userInfoResponse.ok) throw new Error('Failed to fetch user info');

      const userInfo = await userInfoResponse.json();
      email = userInfo.email;
      sub = userInfo.sub;
      picture = userInfo.picture;
      console.log('[GOOGLE AUTH] Access token verified:', { email, sub });
    }

    // Check if user exists by google_id OR email
    console.log('[GOOGLE AUTH] Checking for existing user:', { sub, email });
    let user = await get('SELECT * FROM users WHERE google_id = ? OR email = ?', [sub, email]);
    console.log('[GOOGLE AUTH] User found:', user ? `Yes (${user.email})` : 'No');

    if (!user) {
      // Create new user
      // We use email as username for google users, but we must ensure uniqueness
      // If username exists (e.g. manual register), we append google id part
      let username = email.split('@')[0];
      const existingUsername = await get('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUsername) {
        username = `${username}_${sub.slice(-4)}`;
      }

      const id = uuidv4();
      const dummyPassword = await bcrypt.hash(uuidv4(), 10);

      // Determine status: Auto-approve admin, others pending
      const ADMIN_EMAIL = 'ezequiel.fredes.mondragon@gmail.com';
      const status = (email === ADMIN_EMAIL) ? 'active' : 'pending';

      await run('INSERT INTO users (id, username, password, email, google_id, role, avatar, must_change_password, status) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
        [id, username, dummyPassword, email, sub, 'user', picture, status]);

      user = { id, username, email, role: 'user', must_change_password: 0, avatar: picture, status };

      if (status === 'pending') {
        console.log(`[AUTH] New user pending approval: ${email}`);
        console.log(`[EMAIL-MOCK] To: ${ADMIN_EMAIL} | Subject: Nueva solicitud de acceso | Body: El usuario ${email} ha solicitado acceso.`);
        return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador. Se ha notificado al responsable.' });
      }

    } else {
      // Update existing user with google info if missing
      if (!user.google_id || !user.avatar) {
        await run('UPDATE users SET google_id = ?, avatar = ? WHERE id = ?', [sub, picture, user.id]);
      }

      // Check status
      if (user.status === 'pending') {
        return res.status(403).json({ error: 'Tu cuenta aún está pendiente de aprobación.' });
      }
    }

    console.log('[GOOGLE AUTH] Generating JWT token for user:', user.id);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.user_role || user.role }, JWT_SECRET, { expiresIn: '24h' });

    console.log('[GOOGLE AUTH] SUCCESS - Sending response');
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        must_change_password: !!user.must_change_password,
        avatar: user.avatar || picture,
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate
      }
    });

  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Change Password
app.post('/api/change-password', authenticateToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?', [hashedPassword, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Admin Approval Endpoints ---

app.get('/api/admin/pending-users', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT email FROM users WHERE id = ?', [req.user.id]);
    if (user?.email !== 'ezequiel.fredes.mondragon@gmail.com') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pending = await query('SELECT id, username, email, google_id FROM users WHERE status = ?', ['pending']);
    res.json(pending);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/approve-user', authenticateToken, async (req, res) => {
  const { userId, action } = req.body; // action: 'approve' or 'reject'
  try {
    const user = await get('SELECT email FROM users WHERE id = ?', [req.user.id]);
    if (user?.email !== 'ezequiel.fredes.mondragon@gmail.com') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (action === 'approve') {
      await run('UPDATE users SET status = ? WHERE id = ?', ['active', userId]);
    } else if (action === 'reject') {
      await run('DELETE FROM users WHERE id = ?', [userId]);
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create User (Admin only)
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await run('INSERT INTO users (id, username, password, role, must_change_password) VALUES (?, ?, ?, ?, 0)',
      [id, username, hashedPassword, role || 'user']);

    res.json({ success: true, id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get All Users (Admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await query('SELECT id, username, role, must_change_password FROM users');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete User (Admin only)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  try {
    // Delete related data first
    await run('DELETE FROM entries WHERE user_id = ?', [id]);
    await run('DELETE FROM goals WHERE user_id = ?', [id]);
    await run('DELETE FROM installments WHERE user_id = ?', [id]);
    await run('DELETE FROM user_configs WHERE user_id = ?', [id]);

    // Delete user
    const result = await run('DELETE FROM users WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update User Role (Admin only)
app.put('/api/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
  }

  try {
    const result = await run('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update User Profile (Self)
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  const { firstName, lastName, birthDate } = req.body;
  const userId = req.user.id;

  try {
    // Only update provided fields
    const updates = [];
    const params = [];

    if (firstName !== undefined) {
      updates.push('firstName = ?');
      params.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('lastName = ?');
      params.push(lastName);
    }
    if (birthDate !== undefined) {
      updates.push('birthDate = ?');
      params.push(birthDate);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No changes' });
    }

    params.push(userId);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    // Fetch updated user to return
    const user = await get('SELECT id, username, role, must_change_password, avatar, firstName, lastName, birthDate FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      user: {
        ...user,
        must_change_password: !!user.must_change_password
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete User Data (Granular)
app.delete('/api/user/data', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { scope, date } = req.body; // scope: 'monthly' | 'annual' | 'all', date: 'YYYY-MM' or 'YYYY'

  console.log(`[DELETE DATA] Request from user ${userId} | Scope: ${scope} | Date: ${date}`);

  if (!scope || !['monthly', 'annual', 'all'].includes(scope)) {
    return res.status(400).json({ error: 'Invalid scope' });
  }

  try {
    let result = { entries: 0, goals: 0, installments: 0, config: 0 };

    if (scope === 'all') {
      // Delete ALL user data (except user account itself)
      const r1 = await run('DELETE FROM entries WHERE user_id = ?', [userId]);
      const r2 = await run('DELETE FROM goals WHERE user_id = ?', [userId]);
      const r3 = await run('DELETE FROM installments WHERE user_id = ?', [userId]);
      // Also clear party expenses where user paid? Maybe too aggressive for 'All Data', usually implies private data. 
      // But user asked for "erase all data of logged account".
      // Let's stick to personal finance data for now as per plan.

      // Optionally could reset config
      // const r4 = await run('DELETE FROM user_configs WHERE user_id = ?', [userId]); 

      result.entries = r1.changes;
      result.goals = r2.changes;
      result.installments = r3.changes;
      // result.config = r4.changes;

    } else if (scope === 'monthly') {
      // format expected: YYYY-MM
      if (!date || !/^\d{4}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format for monthly scope. Expected YYYY-MM' });
      }
      const r1 = await run('DELETE FROM entries WHERE user_id = ? AND month_year = ?', [userId, date]);
      result.entries = r1.changes;

    } else if (scope === 'annual') {
      // format expected: YYYY
      if (!date || !/^\d{4}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format for annual scope. Expected YYYY' });
      }
      const r1 = await run('DELETE FROM entries WHERE user_id = ? AND month_year LIKE ?', [userId, `${date}-%`]);
      result.entries = r1.changes;
    }

    console.log(`[DELETE DATA] Success. Deleted:`, result);
    res.json({ success: true, deleted: result });

  } catch (error) {
    console.error('[DELETE DATA] Error:', error);
    res.status(500).json({ error: 'Server error during data deletion' });
  }
});

// --- Data Endpoints ---

// GET /api/data (Optional year)
app.get('/api/data', authenticateToken, async (req, res) => {
  const { year } = req.query;
  const userId = req.user.id;
  try {
    let entries;
    if (year) {
      entries = await query('SELECT * FROM entries WHERE user_id = ? AND month_year LIKE ?', [userId, `${year}-%`]);
    } else {
      entries = await query('SELECT * FROM entries WHERE user_id = ?', [userId]);
    }
    res.json(entries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 8. Update Party
app.put('/api/parties/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const userId = req.user.id;

  try {
    const party = await get('SELECT created_by FROM parties WHERE id = ?', [id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });
    if (party.created_by !== userId) return res.status(403).json({ error: 'Not authorized' });

    await run('UPDATE parties SET name = ?, description = ? WHERE id = ?', [name, description, id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 9. Delete Party
app.delete('/api/parties/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const party = await get('SELECT created_by FROM parties WHERE id = ?', [id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });
    if (party.created_by !== userId) return res.status(403).json({ error: 'Not authorized' });

    // Delete everything related to party
    await run('DELETE FROM party_expenses WHERE party_id = ?', [id]);
    await run('DELETE FROM party_members WHERE party_id = ?', [id]);
    await run('DELETE FROM party_nicknames WHERE party_id = ?', [id]);

    // Attempt to delete installment plans if table exists (ignoring error if not)
    try { await run('DELETE FROM party_installment_plans WHERE party_id = ?', [id]); } catch (e) { }

    await run('DELETE FROM parties WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 10. Delete Party Expense
app.delete('/api/parties/:partyId/expenses/:expenseId', authenticateToken, async (req, res) => {
  const { partyId, expenseId } = req.params;
  const userId = req.user.id;

  try {
    const expense = await get('SELECT payer_id FROM party_expenses WHERE id = ? AND party_id = ?', [expenseId, partyId]);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const party = await get('SELECT created_by FROM parties WHERE id = ?', [partyId]);

    // Allow if user is payer OR party creator
    if (expense.payer_id !== userId && party?.created_by !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await run('DELETE FROM party_expenses WHERE id = ?', [expenseId]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 11. Update Party Expense
app.put('/api/parties/:partyId/expenses/:expenseId', authenticateToken, async (req, res) => {
  const { partyId, expenseId } = req.params;
  const { description, amount, date, participants, category } = req.body;
  const userId = req.user.id;

  try {
    const member = await get('SELECT status FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?', [partyId, userId, 'accepted']);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const participantsJson = JSON.stringify(participants || []);
    await run('UPDATE party_expenses SET description=?, amount=?, date=?, participants=?, category=? WHERE id=? AND party_id=?',
      [description, amount, date, participantsJson, category, expenseId, partyId]);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 12. Remove Member (Cancel Invitation or Kick)
app.delete('/api/parties/members/:memberId', authenticateToken, async (req, res) => {
  const { memberId } = req.params;
  const userId = req.user.id;

  try {
    // Get member info to check party rights
    const targetMember = await get('SELECT * FROM party_members WHERE id = ?', [memberId]);
    if (!targetMember) return res.status(404).json({ error: 'Member not found' });

    const party = await get('SELECT created_by FROM parties WHERE id = ?', [targetMember.party_id]);

    // Only creator can remove members, OR user can remove themselves (leave party)
    const isSelf = targetMember.user_id === userId;
    const isCreator = party?.created_by === userId;

    if (!isSelf && !isCreator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await run('DELETE FROM party_members WHERE id = ?', [memberId]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});



// POST /api/entries
app.post('/api/entries', authenticateToken, async (req, res) => {
  let body = req.body;
  const userId = req.user.id;
  const { id } = body;

  try {
    // Sanitize inputs (ensure undefined becomes null)
    const name = body.name || null;
    const amount = body.amount ?? 0;
    const category = body.category || null;
    const tag = body.tag || null;
    const date = body.date || null;
    const paymentMethod = body.paymentMethod || null;
    const status = body.status || null;
    const month_year = body.month_year || null;
    const cardName = body.cardName || null;
    const financingPlan = body.financingPlan || null;
    const originalAmount = body.originalAmount ?? amount;
    const currency = body.currency || 'ARS'; // Local server default
    const exchangeRateEstimated = body.exchangeRateEstimated ?? 1;
    const exchangeRateActual = body.exchangeRateActual ?? 1;
    const is_provisional = body.is_provisional ? 1 : 0;
    const linked_income_id = body.linkedIncomeId || null;
    const application = body.application || null;

    // Check if entry exists and belongs to user
    const exists = await get('SELECT id FROM entries WHERE id = ? AND user_id = ?', [id, userId]);

    if (exists) {
      await run(`
        UPDATE entries 
        SET name = ?, amount = ?, category = ?, tag = ?, date = ?, paymentMethod = ?, status = ?, month_year = ?, 
            cardName = ?, financingPlan = ?, originalAmount = ?, currency = ?, exchangeRateEstimated = ?, 
            exchangeRateActual = ?, is_provisional = ?, linked_income_id = ?, application = ?
        WHERE id = ? AND user_id = ?
      `, [name, amount, category, tag, date, paymentMethod, status, month_year, cardName, financingPlan, originalAmount, currency, exchangeRateEstimated, exchangeRateActual, is_provisional, linked_income_id, application, id, userId]);
    } else {
      await run(`
        INSERT INTO entries (
            id, name, amount, category, tag, date, paymentMethod, status, month_year, 
            cardName, financingPlan, user_id, originalAmount, currency, exchange_rate_estimated, 
            exchange_rate_actual, is_provisional, linked_income_id, application
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, name, amount, category, tag, date, paymentMethod, status, month_year, cardName, financingPlan, userId, originalAmount, currency, exchangeRateEstimated, exchangeRateActual, is_provisional, linked_income_id, application]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/entries/:id
app.delete('/api/entries/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const info = await run('DELETE FROM entries WHERE id = ? AND user_id = ?', [id, userId]);
    if (info.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Entry not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Goals API ---

app.get('/api/goals', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const goals = await query('SELECT * FROM goals WHERE user_id = ?', [userId]);
    res.json(goals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/goals', authenticateToken, async (req, res) => {
  const { id, name, targetAmount, currentAmount, deadline, icon } = req.body;
  const userId = req.user.id;

  if (!id || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const exists = await get('SELECT id FROM goals WHERE id = ? AND user_id = ?', [id, userId]);
    if (exists) {
      await run(`UPDATE goals SET name=?, targetAmount=?, currentAmount=?, deadline=?, icon=? WHERE id=? AND user_id=?`,
        [name, targetAmount, currentAmount, deadline, icon, id, userId]);
    } else {
      await run(`INSERT INTO goals (id, name, targetAmount, currentAmount, deadline, icon, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, name, targetAmount, currentAmount, deadline, icon, userId]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    await run('DELETE FROM goals WHERE id = ? AND user_id = ?', [id, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});


// --- Installments API ---
app.get('/api/installments', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const installments = await query('SELECT * FROM installments WHERE user_id = ?', [userId]);
    res.json(installments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/installments', authenticateToken, async (req, res) => {
  const { id, name, totalAmount, installments, startDate, description, category, cardName } = req.body;
  const userId = req.user.id;

  if (!id || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const exists = await get('SELECT id FROM installments WHERE id = ? AND user_id = ?', [id, userId]);
    const linked_income_id = body.linkedIncomeId || null;
    const application = body.application || null;

    if (exists) {
      await run(`UPDATE installments SET name=?, totalAmount=?, installments=?, startDate=?, description=?, category=?, cardName=?, linked_income_id=?, application=? WHERE id=? AND user_id=?`,
        [name, totalAmount, installments, startDate, description, category, cardName, linked_income_id, application, id, userId]);
    } else {
      await run(`INSERT INTO installments (id, name, totalAmount, installments, startDate, description, category, cardName, linked_income_id, application, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, totalAmount, installments, startDate, description, category, cardName, linked_income_id, application, userId]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/installments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    await run('DELETE FROM installments WHERE id = ? AND user_id = ?', [id, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Config API ---
app.get('/api/config', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    // Try to get user config
    let config = await get('SELECT * FROM user_configs WHERE user_id = ?', [userId]);

    // If no user config, try global config (legacy) or default
    if (!config) {
      // Return default config
      config = {
        user_id: userId,
        currency: 'ARS',
        categories: JSON.stringify({
          ingresos: ['Sueldo', 'Ventas', 'Otros'],
          gastos: ['Alquiler', 'Comida', 'Servicios', 'Transporte', 'Salud', 'Ocio']
        }),
        creditCards: JSON.stringify([])
      };
    }

    if (config) {
      try { config.categories = JSON.parse(config.categories || '{}'); } catch (e) { config.categories = {}; }
      try { config.creditCards = JSON.parse(config.creditCards || '[]'); } catch (e) { config.creditCards = []; }
      res.json(config);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/config', authenticateToken, async (req, res) => {
  const { currency, categories, creditCards } = req.body;
  const userId = req.user.id;
  try {
    const categoriesJson = JSON.stringify(categories);
    const creditCardsJson = JSON.stringify(creditCards || []);

    const exists = await get('SELECT user_id FROM user_configs WHERE user_id = ?', [userId]);
    if (exists) {
      await run('UPDATE user_configs SET currency=?, categories=?, creditCards=? WHERE user_id=?', [currency, categoriesJson, creditCardsJson, userId]);
    } else {
      await run('INSERT INTO user_configs (user_id, currency, categories, creditCards) VALUES (?, ?, ?, ?)', [userId, currency, categoriesJson, creditCardsJson]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});


// --- Google Drive Sync API ---

app.post('/api/sync/drive/upload', authenticateToken, async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'Access token required' });

  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const dbPath = process.env.DB_PATH || path.join(__dirname, 'finanzas.db');
    const fileContent = fs.readFileSync(dbPath);

    // 1. Search if file already exists
    const response = await drive.files.list({
      q: "name = 'nexus_finances_backup.db' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    const existingFiles = response.data.files;
    let fileId;

    if (existingFiles.length > 0) {
      fileId = existingFiles[0].id;
      // Update existing file
      await drive.files.update({
        fileId: fileId,
        media: {
          mimeType: 'application/x-sqlite3',
          body: fs.createReadStream(dbPath)
        }
      });
      console.log(`Drive: Backup updated (${fileId})`);
    } else {
      // Create new file
      const fileMetadata = {
        name: 'nexus_finances_backup.db',
        description: 'Nexus Finances Database Backup'
      };
      const media = {
        mimeType: 'application/x-sqlite3',
        body: fs.createReadStream(dbPath)
      };
      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });
      fileId = file.data.id;
      console.log(`Drive: Backup created (${fileId})`);
    }

    res.json({ success: true, fileId });
  } catch (error) {
    console.error('Drive Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload to Google Drive' });
  }
});

app.post('/api/sync/drive/download', authenticateToken, async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'Access token required' });

  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 1. Search for the file
    const response = await drive.files.list({
      q: "name = 'nexus_finances_backup.db' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    const files = response.data.files;
    if (files.length === 0) {
      return res.status(404).json({ error: 'No backup found in Google Drive' });
    }

    const fileId = files[0].id;
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'finanzas.db');

    // 2. Download file
    const dest = fs.createWriteStream(dbPath);
    const resDrive = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    resDrive.data
      .on('end', () => {
        console.log(`Drive: Backup downloaded and restored (${fileId})`);
        res.json({ success: true });
      })
      .on('error', err => {
        console.error('Error downloading from Drive', err);
        res.status(500).json({ error: 'Error downloading file' });
      })
      .pipe(dest);

  } catch (error) {
    console.error('Drive Download Error:', error);
    res.status(500).json({ error: 'Failed to download from Google Drive' });
  }
});

// --- Gemini Integration (Protected?) ---
// Let's protect it too
app.post('/api/parse-document', authenticateToken, upload.single('file'), async (req, res) => {
  // ... (Same Gemini logic as before, just wrapped in auth)
  console.log('--- Request received at /api/parse-document ---');
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const apiKey = process.env.API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API Key not configured' });

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";

    const fileBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    let prompt = `
      Analiza este documento financiero y extrae las transacciones.
      Clasifica cada ítem en una de estas categorías:
      - INCOME
      - FIXED_EXPENSE
      - DEBT
      - SAVINGS

      Responde estrictamente en formato JSON.
    `;

    const parts = [];

    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
      try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        prompt += `\n\nAquí están los datos del archivo Excel (en formato CSV). Úsalos para extraer las transacciones:\n${csv}`;
        parts.push({ text: prompt });
      } catch (xlsxError) {
        console.error('Error parsing Excel file:', xlsxError);
        return res.status(500).json({ error: 'Failed to parse Excel file' });
      }
    } else {
      parts.push({ inlineData: { data: fileBase64, mimeType } });
      parts.push({ text: prompt });
    }

    const result = await genAI.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  category: { type: Type.STRING, enum: ["INCOME", "FIXED_EXPENSE", "DEBT", "SAVINGS"] },
                  tag: { type: Type.STRING }
                },
                required: ["name", "amount", "category", "tag"]
              }
            }
          }
        }
      }
    });

    const text = result.response.text();
    const parsed = JSON.parse(text);
    res.json(parsed);

  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: 'Error processing document with AI' });
  }
});

// --- PARTY SYSTEM (Shared Expenses) ---

// 1. Create Party
app.post('/api/parties', authenticateToken, async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;
  const username = req.user.username;

  if (!name) return res.status(400).json({ error: 'Name required' });

  const partyId = uuidv4();
  const now = new Date().toISOString();

  try {
    await run('INSERT INTO parties (id, name, created_by, created_at) VALUES (?, ?, ?, ?)', [partyId, name, userId, now]);

    // Add Creator as Member
    const memberId = uuidv4();
    await run('INSERT INTO party_members (id, party_id, user_id, status, invited_email, joined_at) VALUES (?, ?, ?, ?, ?, ?)',
      [memberId, partyId, userId, 'accepted', username, now]);

    res.json({ success: true, partyId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 2. Invite User (Email)
app.post('/api/parties/invite', authenticateToken, async (req, res) => {
  const { partyId, email } = req.body;
  if (!partyId || !email) return res.status(400).json({ error: 'Missing fields' });

  try {
    const invitedUser = await get('SELECT id FROM users WHERE email = ?', [email]);
    const now = new Date().toISOString();
    const memberId = uuidv4();
    const targetUserId = invitedUser ? invitedUser.id : null;

    await run('INSERT INTO party_members (id, party_id, user_id, status, invited_email, joined_at) VALUES (?, ?, ?, ?, ?, ?)',
      [memberId, partyId, targetUserId, 'pending', email.toLowerCase(), now]);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 2b. Add Virtual Guest
app.post('/api/parties/:id/guests', authenticateToken, async (req, res) => {
  const { id: partyId } = req.params;
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: 'Guest name required' });

  try {
    // Verify membership
    const userId = req.user.id;
    const member = await get('SELECT status FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?', [partyId, userId, 'accepted']);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const memberId = uuidv4();
    const now = new Date().toISOString();

    // Added is_guest = 1
    await run('INSERT INTO party_members (id, party_id, status, guest_name, joined_at, is_guest) VALUES (?, ?, ?, ?, ?, ?)',
      [memberId, partyId, 'guest', name, now, 1]);

    res.json({ success: true, memberId });
  } catch (error) {
    console.error('Virtual Guest Creation Error:', error);
    // Return actual error message for debugging
    res.status(500).json({ error: error.message || 'Database error' });
  }
});

// 2c. Get Public Users (For Autocomplete)
app.get('/api/users/public', authenticateToken, async (req, res) => {
  try {
    // Check if status column exists in users table to avoid 500 errors
    const tableInfo = await query('PRAGMA table_info(users)');
    const hasStatus = tableInfo.some(col => col.name === 'status');

    let users;
    if (hasStatus) {
      users = await query('SELECT id, username, firstName, lastName, avatar FROM users WHERE status = ?', ['active']);
    } else {
      users = await query('SELECT id, username, firstName, lastName, avatar FROM users');
    }
    res.json(users);
  } catch (error) {
    console.error('Error fetching public users:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. Get Pending Invitations
app.get('/api/invitations', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const fullUser = await get('SELECT email FROM users WHERE id = ?', [userId]);
    const email = fullUser?.email;

    let queryStr = 'SELECT pm.id, p.name as partyName, pm.invited_email FROM party_members pm JOIN parties p ON pm.party_id = p.id WHERE pm.status = ? AND (pm.user_id = ?';
    const params = ['pending', userId];

    if (email) {
      queryStr += ' OR pm.invited_email = ?';
      params.push(email);
    }
    queryStr += ')';

    const invites = await query(queryStr, params);
    res.json(invites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 4. Respond to Invitation
app.post('/api/invitations/:id/respond', authenticateToken, async (req, res) => {
  const inviteId = req.params.id;
  const userId = req.user.id;
  const { accept } = req.body;
  const status = accept ? 'accepted' : 'rejected';

  try {
    await run('UPDATE party_members SET status = ?, user_id = ? WHERE id = ?', [status, userId, inviteId]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 5. Get My Parties
app.get('/api/parties', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const parties = await query(`
      SELECT p.* FROM parties p
      JOIN party_members pm ON p.id = pm.party_id
      WHERE pm.user_id = ? AND pm.status = 'accepted'
    `, [userId]);
    res.json(parties);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 6. Get Party Details
app.get('/api/parties/:id', authenticateToken, async (req, res) => {
  const partyId = req.params.id;
  const userId = req.user.id;

  try {
    const membership = await get('SELECT status FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?', [partyId, userId, 'accepted']);
    if (!membership) return res.status(403).json({ error: 'Not a member' });

    const expenses = await query('SELECT * FROM party_expenses WHERE party_id = ? ORDER BY date DESC', [partyId]);
    const members = await query(`
      SELECT u.id, u.username, u.email, u.firstName, u.lastName, u.avatar, pm.id as memberId, pm.invited_email, pm.status, pm.is_guest, pm.guest_name
      FROM party_members pm 
      LEFT JOIN users u ON pm.user_id = u.id 
      WHERE pm.party_id = ? AND (pm.status = 'accepted' OR pm.status = 'guest' OR pm.status = 'pending')
    `, [partyId]);

    res.json({ expenses, members });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 7. Add Expense
app.post('/api/parties/:id/expenses', authenticateToken, async (req, res) => {
  const partyId = req.params.id;
  const userId = req.user.id;
  const { description, amount, date, participants, category } = req.body;

  const expenseId = uuidv4();
  const participantsJson = JSON.stringify(participants || []);

  try {
    await run('INSERT INTO party_expenses (id, party_id, payer_id, amount, description, date, participants, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [expenseId, partyId, userId, amount, description, date, participantsJson, category]);
    res.json({ success: true, expenseId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Party Installments & Extras ---

// Get Party Installments
app.get('/api/parties/:id/installments', authenticateToken, async (req, res) => {
  const partyId = req.params.id;
  try {
    const plans = await query('SELECT * FROM installment_plans WHERE party_id = ?', [partyId]);
    // Parse participants JSON
    const parsed = plans.map(p => ({
      ...p,
      participants: p.participants ? JSON.parse(p.participants) : []
    }));
    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create Installment Plan
app.post('/api/parties/:id/installments', authenticateToken, async (req, res) => {
  const { id: partyId } = req.params;
  const { name, description, total_amount, installments_count, installment_amount, start_date, participants, currency, exchangeRate } = req.body;
  const userId = req.user.id;

  const finalName = name || description;

  if (!finalName || !total_amount || !installments_count || !start_date || !participants) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  try {
    const member = await get('SELECT status FROM party_members WHERE party_id = ? AND user_id = ?', [partyId, userId]);
    if (!member) return res.status(403).json({ error: 'No eres miembro de este grupo.' });

    const planId = uuidv4();
    const participantsJson = JSON.stringify(participants);
    const createdAt = Date.now();

    // If installment_amount is not sent, calculate it
    const calcInstallmentAmount = installment_amount || ((total_amount / (participants.length + 1)) / installments_count);

    await run(
      'INSERT INTO installment_plans (id, party_id, description, total_amount, installments_count, installment_amount, payer_id, participants, start_date, created_at, created_by, currency, exchange_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [planId, partyId, finalName, total_amount, installments_count, calcInstallmentAmount, userId, participantsJson, start_date, createdAt, userId, currency || 'ARS', exchangeRate || 1]
    );

    res.status(201).json({ success: true, id: planId });
  } catch (error) {
    console.error('Error creating installment plan:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor al crear el plan de cuotas.' });
  }
});

// Update Party Installment Plan
app.put('/api/parties/:id/installments/:planId', authenticateToken, async (req, res) => {
  const { id, planId } = req.params; // partyId is id
  const { name, total_amount, installments_count, installment_amount, start_date, description, participants } = req.body;

  try {
    const participantsJson = JSON.stringify(participants || []);
    await run(`UPDATE installment_plans SET 
      description=?, total_amount=?, installments_count=?, installment_amount=?, start_date=?, participants=?
      WHERE id=? AND party_id=?`,
      [name || description, total_amount, installments_count, installment_amount, start_date, participantsJson, planId, id]);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete Party Installment Plan
app.delete('/api/parties/:id/installments/:planId', authenticateToken, async (req, res) => {
  const { id, planId } = req.params;
  try {
    await run('DELETE FROM party_installment_plans WHERE id = ? AND party_id = ?', [planId, id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get Nicknames
app.get('/api/parties/:id/nicknames', authenticateToken, async (req, res) => {
  const partyId = req.params.id;
  try {
    const rows = await query('SELECT member_id, nickname FROM party_nicknames WHERE party_id = ?', [partyId]);
    const nicknames = {};
    rows.forEach(r => nicknames[r.member_id] = r.nickname);
    res.json({ nicknames });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Set Nickname
app.put('/api/parties/:id/nicknames/:memberId', authenticateToken, async (req, res) => {
  const { id, memberId } = req.params;
  const { nickname } = req.body;
  try {
    await run(`INSERT INTO party_nicknames (party_id, member_id, nickname) VALUES (?, ?, ?)
      ON CONFLICT(party_id, member_id) DO UPDATE SET nickname = excluded.nickname`,
      [id, memberId, nickname]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add Guest Member
// Removed duplicate endpoint

// 9. Delete Party
app.delete('/api/parties/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const party = await get('SELECT created_by FROM parties WHERE id = ?', [id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });
    if (party.created_by !== userId) return res.status(403).json({ error: 'Not authorized' });

    // Delete everything related to party
    // Note: With foreign keys ON DELETE CASCADE, most of this is automatic,
    // but we do it explicitly to be safe and ensure older SQLite versions behave.
    await run('DELETE FROM party_expenses WHERE party_id = ?', [id]);
    await run('DELETE FROM party_members WHERE party_id = ?', [id]);
    await run('DELETE FROM party_nicknames WHERE party_id = ?', [id]);

    try { await run('DELETE FROM party_installment_plans WHERE party_id = ?', [id]); } catch (e) { }

    await run('DELETE FROM parties WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Initialize Super Admin ---
const initSuperAdmin = async () => {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS category_budgets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        category TEXT,
        amount REAL,
        UNIQUE(user_id, category),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);
  } catch (error) {
    console.error('Error initializing super admin:', error);
  }
};

// --- Budgets API ---

app.get('/api/budgets', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const budgets = await query('SELECT category, amount FROM category_budgets WHERE user_id = ?', [userId]);
    res.json(budgets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/budgets', authenticateToken, async (req, res) => {
  const { category, amount } = req.body;
  const userId = req.user.id;

  if (!category || amount === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const exists = await get('SELECT id FROM category_budgets WHERE user_id = ? AND category = ?', [userId, category]);

    if (exists) {
      await run('UPDATE category_budgets SET amount = ? WHERE user_id = ? AND category = ?', [amount, userId, category]);
    } else {
      const id = uuidv4();
      await run('INSERT INTO category_budgets (id, user_id, category, amount) VALUES (?, ?, ?, ?)', [id, userId, category, amount]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// D1 Sync Endpoint (Development Only)
app.post('/api/admin/sync-from-d1', authenticateToken, async (req, res) => {
  // Only allow in development/localhost
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    const { execSync } = await import('child_process');
    const scriptPath = path.join(__dirname, '../scripts/sync-db.cjs');

    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({ error: 'Sync script not found' });
    }

    console.log('🔄 Starting D1 sync from production...');
    execSync(`node "${scriptPath}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    res.json({ success: true, message: 'Database synced successfully from D1' });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message || 'Sync failed' });
  }
});

// Serve static files from React app in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initSuperAdmin();
});
