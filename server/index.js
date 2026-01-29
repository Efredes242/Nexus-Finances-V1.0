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
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Credential required' });
  }

  try {
    // Verify token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const { email, name, sub, picture } = payload; // sub is the unique google id

    // Check if user exists by google_id OR email
    let user = await get('SELECT * FROM users WHERE google_id = ? OR email = ?', [sub, email]);

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
      // Password null or empty string for google users (since we use bcrypt compare, empty string won't match any hash easily, but better to handle it)
      // Here we insert empty string or random hash to prevent manual login with empty password
      const dummyPassword = await bcrypt.hash(uuidv4(), 10);

      await run('INSERT INTO users (id, username, password, email, google_id, role, avatar, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        [id, username, dummyPassword, email, sub, 'user', picture]);

      user = { id, username, email, role: 'user', must_change_password: 0, avatar: picture };
    } else {
      // Update existing user with google info if missing
      if (!user.google_id || !user.avatar) {
        await run('UPDATE users SET google_id = ?, avatar = ? WHERE id = ?', [sub, picture, user.id]);
      }
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.user_role || user.role }, JWT_SECRET, { expiresIn: '24h' });

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

// POST /api/entries
app.post('/api/entries', authenticateToken, async (req, res) => {
  const { id, name, amount, category, tag, date, paymentMethod, status, month_year, cardName, financingPlan, originalAmount, currency, exchangeRateEstimated, exchangeRateActual } = req.body;
  const userId = req.user.id;

  if (!id || !name || !amount || !category || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if entry exists and belongs to user
    const exists = await get('SELECT id FROM entries WHERE id = ? AND user_id = ?', [id, userId]);

    if (exists) {
      await run(`
        UPDATE entries 
        SET name = ?, amount = ?, category = ?, tag = ?, date = ?, paymentMethod = ?, status = ?, month_year = ?, cardName = ?, financingPlan = ?, originalAmount = ?, currency = ?, exchangeRateEstimated = ?, exchangeRateActual = ?
        WHERE id = ? AND user_id = ?
      `, [name, amount, category, tag, date, paymentMethod, status, month_year, cardName, financingPlan, originalAmount, currency, exchangeRateEstimated, exchangeRateActual, id, userId]);
    } else {
      await run(`
        INSERT INTO entries (id, name, amount, category, tag, date, paymentMethod, status, month_year, cardName, financingPlan, user_id, originalAmount, currency, exchangeRateEstimated, exchangeRateActual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, name, amount, category, tag, date, paymentMethod, status, month_year, cardName, financingPlan, userId, originalAmount, currency, exchangeRateEstimated, exchangeRateActual]);
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
    if (exists) {
      await run(`UPDATE installments SET name=?, totalAmount=?, installments=?, startDate=?, description=?, category=?, cardName=? WHERE id=? AND user_id=?`,
        [name, totalAmount, installments, startDate, description, category, cardName, id, userId]);
    } else {
      await run(`INSERT INTO installments (id, name, totalAmount, installments, startDate, description, category, cardName, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, totalAmount, installments, startDate, description, category, cardName, userId]);
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
