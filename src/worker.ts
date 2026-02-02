
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';

type Bindings = {
    DB: D1Database;
    JWT_SECRET: string;
};

type Variables = {
    user: any;
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// Middleware
app.use('*', cors({
    origin: (origin) => {
        if (origin.endsWith('pages.dev') || origin.endsWith('ezequielfredes.com.ar') || origin.includes('localhost')) {
            return origin;
        }
        return origin; // Fallback to echo origin or specific default
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}));

const getJwtSecret = (c: any) => c.env.JWT_SECRET || 'super_secret_key_change_me';

// Auth Middleware
const authMiddleware = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);

    const token = authHeader.split(' ')[1];
    try {
        const payload = await verify(token, getJwtSecret(c), 'HS256');
        c.set('user', payload);
        await next();
    } catch (e) {
        return c.json({ error: 'Invalid Token' }, 403);
    }
};

// --- AUTH ROUTES ---

// Google Auth
app.post('/api/auth/google', async (c) => {
    const { credential, accessToken } = await c.req.json();
    if (!credential && !accessToken) return c.json({ error: 'Credential or Access Token required' }, 400);

    try {
        let payload;

        if (credential) {
            // Verify with Google REST API (Worker Compatible)
            const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
            if (!googleRes.ok) {
                return c.json({ error: 'Invalid Google Token' }, 401);
            }
            payload = await googleRes.json();
        } else if (accessToken) {
            // Verify Access Token via UserInfo
            const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!googleRes.ok) {
                return c.json({ error: 'Invalid Access Token' }, 401);
            }
            payload = await googleRes.json();
        }

        // @ts-ignore
        const { email, sub, picture, given_name, family_name, name } = payload;

        let user = await c.env.DB.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').bind(sub, email).first();

        if (!user) {
            let username = email.split('@')[0];
            const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
            if (existingUsername) {
                username = `${username}_${sub.slice(-4)}`;
            }

            const id = crypto.randomUUID();
            const dummyPassword = await bcrypt.hash(crypto.randomUUID(), 10);

            // Use given_name/family_name if available, else split 'name', else null
            let firstName = given_name || (name ? name.split(' ')[0] : null);
            let lastName = family_name || (name ? name.split(' ').slice(1).join(' ') : null);

            await c.env.DB.prepare('INSERT INTO users (id, username, password, email, google_id, role, avatar, must_change_password, firstName, lastName) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
                .bind(id, username, dummyPassword, email, sub, 'user', picture, firstName, lastName)
                .run();

            user = { id, username, email, role: 'user', must_change_password: 0, avatar: picture, firstName, lastName, birthDate: null };
        } else {
            // @ts-ignore
            if (!user.google_id || !user.avatar) {
                // @ts-ignore
                await c.env.DB.prepare('UPDATE users SET google_id = ?, avatar = ? WHERE id = ?')
                    // @ts-ignore
                    .bind(sub, picture, user.id).run();
            }
        }

        const token = await sign({
            // @ts-ignore
            id: user.id, username: user.username, role: user.role
        }, getJwtSecret(c));

        return c.json({
            token,
            user: {
                // @ts-ignore
                id: user.id,
                // @ts-ignore
                username: user.username,
                // @ts-ignore
                role: user.role,
                // @ts-ignore
                must_change_password: !!user.must_change_password,
                // @ts-ignore
                avatar: user.avatar || picture,
                // @ts-ignore
                firstName: user.firstName,
                // @ts-ignore
                lastName: user.lastName,
                // @ts-ignore
                birthDate: user.birthDate
            }
        });

    } catch (e) {
        console.error(e);
        return c.json({ error: 'Auth failed' }, 500);
    }
});

// Login
app.post('/api/login', async (c) => {
    const { username, password } = await c.req.json();

    try {
        const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();

        if (!user) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }

        // @ts-ignore
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }

        const token = await sign({
            // @ts-ignore
            id: user.id, username: user.username, role: user.role
        }, getJwtSecret(c));

        return c.json({
            token,
            user: {
                // @ts-ignore
                id: user.id,
                // @ts-ignore
                username: user.username,
                // @ts-ignore
                role: user.role,
                // @ts-ignore
                must_change_password: !!user.must_change_password,
                // @ts-ignore
                firstName: user.firstName,
                // @ts-ignore
                lastName: user.lastName,
                // @ts-ignore
                birthDate: user.birthDate,
                // @ts-ignore
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Server error' }, 500);
    }
});

// Register
app.post('/api/register', async (c) => {
    const { username, password } = await c.req.json();

    if (!username || !password || password.length < 6) {
        return c.json({ error: 'Invalid input' }, 400);
    }

    try {
        const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
        if (existing) {
            return c.json({ error: 'Username already exists' }, 400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();

        await c.env.DB.prepare('INSERT INTO users (id, username, password, role, must_change_password) VALUES (?, ?, ?, ?, 0)')
            .bind(id, username, hashedPassword, 'user')
            .run();

        const token = await sign({ id, username, role: 'user' }, getJwtSecret(c));

        return c.json({
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
        return c.json({ error: 'Server error' }, 500);
    }
});

// Check Users (Public setup)
app.get('/api/has-users', async (c) => {
    const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    // @ts-ignore
    return c.json({ hasUsers: (result?.count || 0) > 0 });
});

// --- DATA ROUTES ---

// Get User Profile
app.put('/api/users/profile', authMiddleware, async (c) => {
    const user = c.get('user');
    const { firstName, lastName, birthDate } = await c.req.json();

    if (!firstName && !lastName && !birthDate) return c.json({ success: true, message: 'No changes' });

    // Dynamic update query
    const updates: string[] = [];
    const params: any[] = [];

    if (firstName !== undefined) { updates.push('firstName = ?'); params.push(firstName); }
    if (lastName !== undefined) { updates.push('lastName = ?'); params.push(lastName); }
    if (birthDate !== undefined) { updates.push('birthDate = ?'); params.push(birthDate); }

    params.push(user.id);

    await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

    const updatedUser = await c.env.DB.prepare('SELECT id, username, role, must_change_password, avatar, firstName, lastName, birthDate FROM users WHERE id = ?')
        .bind(user.id)
        .first();

    return c.json({
        success: true,
        user: updatedUser
    });
});


// Entries
app.get('/api/data', authMiddleware, async (c) => {
    const user = c.get('user');
    const year = c.req.query('year');

    let results;
    if (year) {
        results = await c.env.DB.prepare('SELECT * FROM entries WHERE user_id = ? AND month_year LIKE ?')
            .bind(user.id, `${year}-%`)
            .all();
    } else {
        results = await c.env.DB.prepare('SELECT * FROM entries WHERE user_id = ?').bind(user.id).all();
    }

    return c.json(results.results);
});

app.post('/api/entries', authMiddleware, async (c) => {
    const user = c.get('user');
    let body;
    try {
        body = await c.req.json();
    } catch (e) {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const { id } = body;
    console.log(`[POST /entries] Processing entry ${id} for user ${user.id}`);

    try {
        // Simplified upsert logic
        const exists = await c.env.DB.prepare('SELECT id FROM entries WHERE id = ? AND user_id = ?').bind(id, user.id).first();

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
        const currency = body.currency || '$';
        const exchangeRateEstimated = body.exchangeRateEstimated ?? 1;
        const exchangeRateActual = body.exchangeRateActual ?? 1;
        const is_provisional = body.is_provisional ? 1 : 0;

        if (exists) {
            await c.env.DB.prepare(`
       UPDATE entries 
       SET name=?, amount=?, category=?, tag=?, date=?, paymentMethod=?, status=?, month_year=?, cardName=?, financingPlan=?, originalAmount=?, currency=?, exchangeRateEstimated=?, exchangeRateActual=?, is_provisional=?
       WHERE id=? AND user_id=?
     `).bind(
                name, amount, category, tag, date, paymentMethod, status, month_year,
                cardName, financingPlan, originalAmount, currency, exchangeRateEstimated, exchangeRateActual, is_provisional,
                id, user.id
            ).run();
        } else {
            await c.env.DB.prepare(`
       INSERT INTO entries (id, name, amount, category, tag, date, paymentMethod, status, month_year, cardName, financingPlan, user_id, originalAmount, currency, exchangeRateEstimated, exchangeRateActual, is_provisional)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
                id, name, amount, category, tag, date, paymentMethod, status, month_year,
                cardName, financingPlan, user.id, originalAmount, currency, exchangeRateEstimated, exchangeRateActual, is_provisional
            ).run();
        }
        return c.json({ success: true });
    } catch (error: any) {
        console.error('[POST /entries] DB Error:', error);
        return c.json({ error: 'Database error', details: error.message }, 500);
    }
});

app.delete('/api/entries/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return c.json({ success: true });
});

// Goals
app.get('/api/goals', authMiddleware, async (c) => {
    const user = c.get('user');
    const res = await c.env.DB.prepare('SELECT * FROM goals WHERE user_id = ?').bind(user.id).all();
    return c.json(res.results);
});

app.post('/api/goals', authMiddleware, async (c) => {
    const user = c.get('user');
    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON' }, 400); }

    const { id } = body;
    const name = body.name || 'Meta sin nombre';
    const targetAmount = body.targetAmount ?? 0;
    const currentAmount = body.currentAmount ?? 0;
    const deadline = body.deadline || null;
    const icon = body.icon || 'star';

    try {
        const exists = await c.env.DB.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').bind(id, user.id).first();
        if (exists) {
            await c.env.DB.prepare('UPDATE goals SET name=?, targetAmount=?, currentAmount=?, deadline=?, icon=? WHERE id=? AND user_id=?')
                .bind(name, targetAmount, currentAmount, deadline, icon, id, user.id).run();
        } else {
            await c.env.DB.prepare('INSERT INTO goals (id, name, targetAmount, currentAmount, deadline, icon, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .bind(id, name, targetAmount, currentAmount, deadline, icon, user.id).run();
        }
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /goals] Error:', e);
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

app.delete('/api/goals/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return c.json({ success: true });
});


// Config
app.get('/api/config', authMiddleware, async (c) => {
    const user = c.get('user');
    const row = await c.env.DB.prepare('SELECT * FROM user_configs WHERE user_id = ?').bind(user.id).first();

    if (!row) {
        return c.json(null, 404);
    }

    const config = {
        // @ts-ignore
        currency: row.currency || 'ARS',
        // @ts-ignore
        categories: row.categories ? JSON.parse(row.categories) : {},
        // @ts-ignore
        creditCards: row.creditCards ? JSON.parse(row.creditCards) : []
    };

    return c.json(config);
});

app.post('/api/config', authMiddleware, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { currency, categories, creditCards } = body;

    try {
        const categoriesJson = JSON.stringify(categories || {});
        const creditCardsJson = JSON.stringify(creditCards || []);

        const exists = await c.env.DB.prepare('SELECT 1 FROM user_configs WHERE user_id = ?').bind(user.id).first();

        if (exists) {
            await c.env.DB.prepare('UPDATE user_configs SET currency = ?, categories = ?, creditCards = ? WHERE user_id = ?')
                .bind(currency || '$', categoriesJson, creditCardsJson, user.id).run();
        } else {
            await c.env.DB.prepare('INSERT INTO user_configs (user_id, currency, categories, creditCards) VALUES (?, ?, ?, ?)')
                .bind(user.id, currency || '$', categoriesJson, creditCardsJson).run();
        }
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /config] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

app.get('/api/parties/:id/expenses', authMiddleware, async (c) => {
    const { id } = c.req.param();
    const expenses = await c.env.DB.prepare('SELECT * FROM expenses WHERE party_id = ? ORDER BY date DESC').bind(id).all();
    return c.json(expenses.results);
});

// --- INSTALLMENT PLANS ROUTES ---

// Get Installment Plans (Multi-Participant Support)
app.get('/api/parties/:partyId/installments', authMiddleware, async (c) => {
    const { partyId } = c.req.param();
    const plans = await c.env.DB.prepare('SELECT * FROM installment_plans WHERE party_id = ? ORDER BY created_at DESC')
        .bind(partyId)
        .all();

    // Parse participants from participants column (new) or debtor_id (legacy fallback)
    const enrichedPlans = (plans.results || []).map((plan: any) => {
        let participants = [];

        // Priority 1: New participants column
        if (plan.participants) {
            try {
                const parsed = JSON.parse(plan.participants);
                participants = Array.isArray(parsed) ? parsed : [plan.participants];
            } catch (e) {
                console.warn('Failed to parse participants column:', e);
            }
        }

        // Priority 2: Fallback to debtor_id (legacy or single participant)
        if (!participants || participants.length === 0) {
            try {
                const parsed = JSON.parse(plan.debtor_id);
                participants = Array.isArray(parsed) ? parsed : [plan.debtor_id];
            } catch {
                // Backward compat: single debtor_id meant one participant
                participants = [plan.debtor_id];
            }
        }

        return { ...plan, participants };
    });

    return c.json(enrichedPlans);
});

// Create Installment Plan (Multi-Participant Support)
app.post('/api/parties/:partyId/installments', authMiddleware, async (c) => {
    const { partyId } = c.req.param();
    const body = await c.req.json();
    const { description, totalAmount, installments, payerId, participantIds, debtorId, startMonth } = body;

    // Backward compatibility: support old debtorId format
    const participants = participantIds || (debtorId ? [debtorId] : []);

    if (!participants || participants.length === 0) {
        return c.json({ error: 'At least one participant required' }, 400);
    }

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    // participantIds contains only debtors, not the payer
    // Total people splitting the cost = participants + payer
    const totalPeople = participants.length + 1;
    const perPersonAmount = totalAmount / (totalPeople * installments);
    const participantsJson = JSON.stringify(participants);

    try {
        const user = c.get('user');
        const createdBy = user.id;

        await c.env.DB.prepare(
            'INSERT INTO installment_plans (id, party_id, description, total_amount, installments_count, installment_amount, payer_id, debtor_id, participants, start_date, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
            .bind(id, partyId, description, totalAmount, installments, perPersonAmount, payerId, participants[0], participantsJson, startMonth, createdAt, createdBy)
            .run();

        return c.json({ id, success: true });
    } catch (error: any) {
        console.error('Error creating installment plan:', error);
        return c.json({ error: 'Failed to create plan', details: error.message }, 500);
    }
});

// Update Installment Plan
app.put('/api/parties/:partyId/installments/:id', authMiddleware, async (c) => {
    const { partyId, id } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();
    const { description, totalAmount, installments, payerId, participantIds, debtorId, startMonth } = body;

    // Check ownership
    const existing = await c.env.DB.prepare('SELECT created_by FROM installment_plans WHERE id = ?').bind(id).first();
    if (!existing || existing.created_by !== user.id) {
        return c.json({ error: 'Unauthorized to edit this plan' }, 403);
    }

    const participants = participantIds || (debtorId ? [debtorId] : []);
    const totalPeople = participants.length + 1;
    const perPersonAmount = totalAmount / (totalPeople * installments);
    const participantsJson = JSON.stringify(participants);

    try {
        await c.env.DB.prepare(
            'UPDATE installment_plans SET description = ?, total_amount = ?, installments_count = ?, installment_amount = ?, payer_id = ?, debtor_id = ?, participants = ?, start_date = ? WHERE id = ?'
        )
            .bind(description, totalAmount, installments, perPersonAmount, payerId, participants[0], participantsJson, startMonth, id)
            .run();

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: 'Failed to update plan', details: error.message }, 500);
    }
});

// Delete Installment Plan
app.delete('/api/parties/:partyId/installments/:id', authMiddleware, async (c) => {
    const { id } = c.req.param();
    await c.env.DB.prepare('DELETE FROM installment_plans WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

app.get('/api/installments', authMiddleware, async (c) => {
    const user = c.get('user');
    const res = await c.env.DB.prepare('SELECT * FROM installments WHERE user_id = ?').bind(user.id).all();
    return c.json(res.results);
});

app.post('/api/installments', authMiddleware, async (c) => {
    const user = c.get('user');
    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON' }, 400); }

    const { id } = body;
    const name = body.name || 'Compra en cuotas';
    const totalAmount = body.totalAmount ?? 0;
    const installments = body.installments ?? 1;
    const startDate = body.startDate || null;
    const description = body.description || null;
    const category = body.category || null;
    const cardName = body.cardName || null;

    try {
        const exists = await c.env.DB.prepare('SELECT id FROM installments WHERE id = ? AND user_id = ?').bind(id, user.id).first();

        if (exists) {
            await c.env.DB.prepare('UPDATE installments SET name=?, totalAmount=?, installments=?, startDate=?, description=?, category=?, cardName=? WHERE id=? AND user_id=?')
                .bind(name, totalAmount, installments, startDate, description, category, cardName, id, user.id).run();
        } else {
            await c.env.DB.prepare('INSERT INTO installments (id, name, totalAmount, installments, startDate, description, category, cardName, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .bind(id, name, totalAmount, installments, startDate, description, category, cardName, user.id).run();
        }
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /installments] Error:', e);
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

app.delete('/api/installments/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM installments WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return c.json({ success: true });
});

app.post('/api/config', authMiddleware, async (c) => {
    const user = c.get('user');
    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON' }, 400); }

    const currency = body.currency || 'ARS';
    const categories = body.categories || {};
    const creditCards = body.creditCards || [];

    const categoriesJson = JSON.stringify(categories);
    const creditCardsJson = JSON.stringify(creditCards);

    try {
        const exists = await c.env.DB.prepare('SELECT user_id FROM user_configs WHERE user_id = ?').bind(user.id).first();

        if (exists) {
            await c.env.DB.prepare('UPDATE user_configs SET currency=?, categories=?, creditCards=? WHERE user_id=?')
                .bind(currency, categoriesJson, creditCardsJson, user.id).run();
        } else {
            await c.env.DB.prepare('INSERT INTO user_configs (user_id, currency, categories, creditCards) VALUES (?, ?, ?, ?)')
                .bind(user.id, currency, categoriesJson, creditCardsJson).run();
        }
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /config] Error:', e);
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

// Category Budgets
app.get('/api/budgets', authMiddleware, async (c) => {
    const user = c.get('user');
    const results = await c.env.DB.prepare('SELECT * FROM category_budgets WHERE user_id = ?').bind(user.id).all();
    return c.json(results.results || []);
});

app.post('/api/budgets', authMiddleware, async (c) => {
    const user = c.get('user');
    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON' }, 400); }

    const { category, amount } = body;
    if (!category) return c.json({ error: 'Category required' }, 400);

    try {
        const exists = await c.env.DB.prepare('SELECT category FROM category_budgets WHERE user_id = ? AND category = ?')
            .bind(user.id, category).first();

        if (exists) {
            await c.env.DB.prepare('UPDATE category_budgets SET amount = ? WHERE user_id = ? AND category = ?')
                .bind(amount || 0, user.id, category).run();
        } else {
            await c.env.DB.prepare('INSERT INTO category_budgets (user_id, category, amount) VALUES (?, ?, ?)')
                .bind(user.id, category, amount || 0).run();
        }
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /budgets] Error:', e);
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});



// --- PARTY (SHARED EXPENSES) ROUTES ---

// 1. Create Party
app.post('/api/parties', authMiddleware, async (c) => {
    const user = c.get('user');
    const { name, description } = await c.req.json();
    if (!name) return c.json({ error: 'Name required' }, 400);

    const partyId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
        // Create Party
        await c.env.DB.prepare('INSERT INTO parties (id, name, created_by, created_at, description) VALUES (?, ?, ?, ?, ?)')
            .bind(partyId, name, user.id, now, description || null).run();

        // Add Creator as Member (Accepted)
        const memberId = crypto.randomUUID();
        await c.env.DB.prepare('INSERT INTO party_members (id, party_id, user_id, status, invited_email, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(memberId, partyId, user.id, 'accepted', user.username, now).run();

        return c.json({ success: true, partyId });
    } catch (e: any) {
        console.error('[POST /parties] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

// 2. Invite User
app.post('/api/parties/invite', authMiddleware, async (c) => {
    const user = c.get('user');
    const { partyId, email } = await c.req.json();
    if (!partyId || !email) return c.json({ error: 'Missing fields' }, 400);

    const normalizedEmail = email.trim().toLowerCase();

    try {
        // Check if user exists in DB
        const invitedUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();

        const now = new Date().toISOString();
        const memberId = crypto.randomUUID();
        let targetUserId = invitedUser ? invitedUser.id : null;
        // If user doesn't exist yet, we still store the invite with NULL user_id but VALID invited_email.
        // When they register/login later, we can link it (advanced) or just show it if they exist now.
        // For this version: We assume they MUST exist or we store just email and check on login?
        // Let's store targetUserId if found, otherwise just email. Logic on 'get invitations' will match by email too.

        await c.env.DB.prepare('INSERT INTO party_members (id, party_id, user_id, status, invited_email, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(memberId, partyId, targetUserId, 'pending', normalizedEmail, now).run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /parties/invite] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

// Update Party (Name/Desc)
app.put('/api/parties/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');
    const { name, description } = await c.req.json();

    try {
        const party = await c.env.DB.prepare('SELECT created_by FROM parties WHERE id = ?').bind(partyId).first();
        if (!party) return c.json({ error: 'Party not found' }, 404);

        // @ts-ignore
        if (String(party.created_by) !== String(user.id)) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        await c.env.DB.prepare('UPDATE parties SET name = ?, description = ? WHERE id = ?')
            .bind(name, description || null, partyId).run();

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: 'Database error' }, 500);
    }
});

// 5b. Cancel Invitation / Remove Member
app.delete('/api/parties/members/:memberId', authMiddleware, async (c) => {
    const user = c.get('user');
    const memberId = c.req.param('memberId');

    try {
        const memberInfo = await c.env.DB.prepare('SELECT party_id, user_id, invited_email FROM party_members WHERE id = ?').bind(memberId).first();
        if (!memberInfo) return c.json({ error: 'Member not found' }, 404);

        // Check if requester is in the party
        const requesterInfo = await c.env.DB.prepare('SELECT * FROM party_members WHERE party_id = ? AND user_id = ?').bind(memberInfo.party_id, user.id).first();
        if (!requesterInfo) return c.json({ error: 'Unauthorized' }, 403);

        await c.env.DB.prepare('DELETE FROM party_members WHERE id = ?').bind(memberId).run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: 'Error deleting member' }, 500);
    }
});

// 2.5 Add Guest Member
app.post('/api/parties/:id/guests', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');
    const { name } = await c.req.json();

    try {
        // Verify creator permission? Or any member? Let's say any member for now for ease.
        const membership = await c.env.DB.prepare('SELECT status FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?')
            .bind(partyId, user.id, 'accepted').first();
        if (!membership) return c.json({ error: 'Not a member' }, 403);

        const memberId = crypto.randomUUID();
        // Insert guest
        // user_id is NULL for guests.
        await c.env.DB.prepare('INSERT INTO party_members (id, party_id, user_id, status, is_guest, guest_name) VALUES (?, ?, NULL, ?, 1, ?)')
            .bind(memberId, partyId, 'accepted', name).run();

        return c.json({ success: true, memberId });
    } catch (e: any) {
        return c.json({ error: 'Database error: ' + e.message }, 500);
    }
});

// DEBUG: Get Users List
app.get('/api/debug/users', async (c) => {
    try {
        const users = await c.env.DB.prepare('SELECT id, username, email, avatar FROM users LIMIT 100').all();
        return c.json(users.results);
    } catch (e) {
        return c.json({ error: 'Failed to fetch users' }, 500);
    }
});

// DEBUG: Get Pending Invitations List
app.get('/api/debug/invitations', async (c) => {
    try {
        const invites = await c.env.DB.prepare('SELECT * FROM party_members WHERE status = "pending" LIMIT 100').all();
        return c.json(invites.results);
    } catch (e) {
        return c.json({ error: 'Failed to fetch invitations' }, 500);
    }
});

// 3. Get Pending Invitations
app.get('/api/invitations', authMiddleware, async (c) => {
    const user = c.get('user');
    try {
        // Find invites where user_id matches OR invited_email matches user's email
        // We need user's email. It should be in the JWT payload or we fetch it.
        // In our authMiddleware we set 'user' from JWT. Let's assume it has email or we fetch.
        // JWT has: id, username, role.

        // Fetch full user to get email
        const fullUser = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(user.id).first();
        // @ts-ignore
        const email = fullUser?.email;

        console.log(`[GET /invitations] Checking for user ${user.id} (${user.username}) with email: ${email}`);

        let query = 'SELECT pm.id, p.name as partyName, pm.invited_email FROM party_members pm JOIN parties p ON pm.party_id = p.id WHERE pm.status = ? AND (pm.user_id = ?';
        const params = ['pending', user.id];

        if (email) {
            query += ' OR LOWER(TRIM(pm.invited_email)) = LOWER(TRIM(?))';
            params.push(email);
        }
        query += ')';

        const invites = await c.env.DB.prepare(query).bind(...params).all();
        console.log(`[GET /invitations] Found ${invites.results?.length || 0} invites`);

        return c.json(invites.results);
    } catch (e: any) {
        console.error('[GET /invitations] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

// 4. Respond to Invitation
app.post('/api/invitations/:id/respond', authMiddleware, async (c) => {
    const user = c.get('user');
    const inviteId = c.req.param('id');
    const { accept } = await c.req.json(); // true or false

    const status = accept ? 'accepted' : 'rejected';

    try {
        // Link user_id if it was null (email invite)
        await c.env.DB.prepare('UPDATE party_members SET status = ?, user_id = ? WHERE id = ?')
            .bind(status, user.id, inviteId).run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /invitations/respond] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

// 5. Get My Parties
app.get('/api/parties', authMiddleware, async (c) => {
    const user = c.get('user');
    try {
        const parties = await c.env.DB.prepare(`
            SELECT p.*, u.username as creator_name 
            FROM parties p
            JOIN party_members pm ON p.id = pm.party_id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE pm.user_id = ? AND pm.status = 'accepted'
        `).bind(user.id).all();
        return c.json(parties.results);
    } catch (e: any) {
        return c.json({ error: 'Database error' }, 500);
    }
});

// 6. Get Party Details (members + expenses)
app.get('/api/parties/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');

    try {
        // Verify membership
        const membership = await c.env.DB.prepare('SELECT status FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?')
            .bind(partyId, user.id, 'accepted').first();

        if (!membership) return c.json({ error: 'Not a member' }, 403);

        const expenses = await c.env.DB.prepare('SELECT * FROM party_expenses WHERE party_id = ? ORDER BY date DESC').bind(partyId).all();
        const members = await c.env.DB.prepare(`
            SELECT COALESCE(u.id, pm.id) as id, 
                   CASE WHEN pm.is_guest = 1 THEN pm.guest_name ELSE u.username END as username,
                   CASE WHEN pm.is_guest = 1 THEN NULL ELSE u.email END as email,
                   u.firstName, u.lastName, u.avatar, 
                   pm.status, pm.invited_email, pm.id as memberId, pm.is_guest, pm.guest_name
            FROM party_members pm 
            LEFT JOIN users u ON pm.user_id = u.id 
            WHERE pm.party_id = ? 
        `).bind(partyId).all();

        return c.json({ expenses: expenses.results, members: members.results });
    } catch (e: any) {
        return c.json({ error: 'Database error' }, 500);
    }
});

// 7. Add Expense
// 7. Add Expense (with optional Installments)
app.post('/api/parties/:id/expenses', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');
    const { description, amount, date, participants, category, installmentData, payerId } = await c.req.json();
    // installmentData: { issuer, installments, first_payment_date } (optional)

    const expenseId = crypto.randomUUID();
    const participantsJson = JSON.stringify(participants || []);

    // Use provided payerId if exists (for "Who paid?" feature), otherwise default to current user
    const finalPayerId = payerId || user.id;

    try {
        const statements = [];

        // 1. Create Party Expense (Updated with installments info)
        const installmentsCount = (installmentData && installmentData.installments > 1) ? installmentData.installments : 1;
        const cardName = (installmentData && installmentData.issuer) ? installmentData.issuer : null;
        const firstPaymentDate = (installmentData && installmentData.first_payment_date) ? installmentData.first_payment_date : null;

        statements.push(
            c.env.DB.prepare('INSERT INTO party_expenses (id, party_id, payer_id, amount, description, date, participants, category, installments_count, card_name, first_payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .bind(expenseId, partyId, finalPayerId, amount, description, date, participantsJson, category, installmentsCount, cardName, firstPaymentDate)
        );

        // 2. If Installments, create personal installment record
        if (installmentData && installmentData.installments > 1 && finalPayerId === user.id) {
            const installmentId = crypto.randomUUID();
            statements.push(
                c.env.DB.prepare('INSERT INTO installments (id, user_id, description, cardName, totalAmount, installments, startDate) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    .bind(installmentId, user.id, `${description} (Grupo)`, installmentData.issuer, amount, installmentData.installments, installmentData.first_payment_date)
            );
        }

        // Execute simply (D1 batch is atomic-like for consecutive execution, though proper transaction support depends on D1 mode, usually good enough here)
        await c.env.DB.batch(statements);

        return c.json({ success: true, expenseId });
    } catch (e: any) {
        console.error('[POST /parties/expenses] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

// 7.5 Update Expense
app.put('/api/parties/:partyId/expenses/:expenseId', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('partyId');
    const expenseId = c.req.param('expenseId');
    const { description, amount, date, participants, category, installmentData, payerId } = await c.req.json();

    try {
        // 1. Verify ownership (Only payer can edit, or maybe admin? strict: only payer)
        const currentExpense = await c.env.DB.prepare('SELECT payer_id FROM party_expenses WHERE id = ?').bind(expenseId).first();
        if (!currentExpense) return c.json({ error: 'Expense not found' }, 404);

        // @ts-ignore
        if (currentExpense.payer_id !== user.id) {
            return c.json({ error: 'Unauthorized: Only the payer can edit this expense' }, 403);
        }

        const participantsJson = JSON.stringify(participants || []);
        const installmentsCount = (installmentData && installmentData.installments > 1) ? installmentData.installments : 1;
        const cardName = (installmentData && installmentData.issuer) ? installmentData.issuer : null;
        const firstPaymentDate = (installmentData && installmentData.first_payment_date) ? installmentData.first_payment_date : null;

        const statements = [];

        // 2. Update Party Expense
        statements.push(
            c.env.DB.prepare(`
                UPDATE party_expenses 
                SET description=?, amount=?, date=?, participants=?, category=?, installments_count=?, card_name=?, first_payment_date=?
                WHERE id=?
            `).bind(description, amount, date, participantsJson, category, installmentsCount, cardName, firstPaymentDate, expenseId)
        );

        // 3. Update Personal Installment if exists (and owned by user)
        // We try to find a linked installment. Usually we don't link via ID nicely in this simple schema
        // but we can try to find one with similar metadata or just skip for now. 
        // For strict correctness, we should have stored foreign keys. 
        // Given existing schema, we might skip updating separate installment table to avoid complexity/bugs, 
        // OR we try to match by description/amount but that's risky.
        // Let's assume for this MVF (Min Viable Feature) we only update the shared expense record.
        // User can manually update their personal records if they differ.

        await c.env.DB.batch(statements);

        return c.json({ success: true });
    } catch (e: any) {
        console.error('[PUT /parties/expenses] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

// 8. Delete Party Expense
app.delete('/api/parties/:partyId/expenses/:expenseId', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const partyId = c.req.param('partyId');
        const expenseId = c.req.param('expenseId');

        console.log(`[DELETE] Request: Party ${partyId}, Expense ${expenseId}, User ${user.id}`);

        if (!partyId || !expenseId) return c.json({ error: 'Missing parameters' }, 400);

        // Get Party
        const party = await c.env.DB.prepare('SELECT created_by FROM parties WHERE id = ?').bind(partyId).first();

        // Get Expense
        const expense = await c.env.DB.prepare('SELECT payer_id FROM party_expenses WHERE id = ?').bind(expenseId).first();

        if (!expense) {
            console.log('[DELETE] Expense not found');
            return c.json({ error: 'Expense not found' }, 404);
        }

        // Permission Check
        const isPayer = expense.payer_id === user.id;
        const isCreator = party && party.created_by === user.id;

        if (!isPayer && !isCreator) {
            console.log(`[DELETE] Unauthorized. Payer: ${expense.payer_id}, Creator: ${party?.created_by}, User: ${user.id}`);
            return c.json({ error: 'Unauthorized: You are not the payer or party creator' }, 403);
        }

        await c.env.DB.prepare('DELETE FROM party_expenses WHERE id = ?').bind(expenseId).run();
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[DELETE ERROR]', e);
        return c.json({ error: `Database error: ${e.message || 'Unknown'}` }, 500);
    }
});

// 9. Delete Party
app.delete('/api/parties/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');

    try {
        // Only creator can delete
        const party = await c.env.DB.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first();
        if (!party) return c.json({ error: 'Party not found' }, 404);
        if (party.created_by !== user.id) return c.json({ error: 'Only creator can delete party' }, 403);

        // Delete dependencies (cascade ideally, but manual here for safety)
        await c.env.DB.prepare('DELETE FROM party_expenses WHERE party_id = ?').bind(partyId).run();
        await c.env.DB.prepare('DELETE FROM party_members WHERE party_id = ?').bind(partyId).run();
        await c.env.DB.prepare('DELETE FROM parties WHERE id = ?').bind(partyId).run();

        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: 'Database error' }, 500);
    }
});

// 10. Get Member Nicknames (User-specific)
app.get('/api/parties/:id/nicknames', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');

    try {
        // Verify membership
        const membership = await c.env.DB.prepare('SELECT status FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?')
            .bind(partyId, user.id, 'accepted').first();

        if (!membership) return c.json({ error: 'Not a member' }, 403);

        // Get all nicknames for this user in this party
        const nicknames = await c.env.DB.prepare('SELECT member_id, nickname FROM member_nicknames WHERE user_id = ? AND party_id = ?')
            .bind(user.id, partyId).all();

        // Convert to object format { memberId: nickname }
        const nicknamesMap: Record<string, string> = {};
        nicknames.results?.forEach((row: any) => {
            nicknamesMap[row.member_id] = row.nickname;
        });

        return c.json({ nicknames: nicknamesMap });
    } catch (e: any) {
        console.error('[GET /parties/nicknames] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

// 11. Set Member Nickname (User-specific)
app.put('/api/parties/:id/nicknames/:memberId', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');
    const memberId = c.req.param('memberId');
    const { nickname } = await c.req.json();

    if (!nickname || typeof nickname !== 'string') {
        return c.json({ error: 'Nickname is required' }, 400);
    }

    try {
        // Verify membership
        const membership = await c.env.DB.prepare('SELECT status FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?')
            .bind(partyId, user.id, 'accepted').first();

        if (!membership) return c.json({ error: 'Not a member' }, 403);

        // Verify target member exists in party
        const targetMember = await c.env.DB.prepare('SELECT id FROM party_members WHERE party_id = ? AND (user_id = ? OR id = ?)')
            .bind(partyId, memberId, memberId).first();

        if (!targetMember) return c.json({ error: 'Member not found in party' }, 404);

        // Upsert nickname (SQLite REPLACE or INSERT OR REPLACE)
        const nicknameId = crypto.randomUUID();
        await c.env.DB.prepare(`
            INSERT INTO member_nicknames (id, user_id, party_id, member_id, nickname) 
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, party_id, member_id) 
            DO UPDATE SET nickname = excluded.nickname
        `).bind(nicknameId, user.id, partyId, memberId, nickname.trim()).run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('[PUT /parties/nicknames] Error:', e);
        return c.json({ error: 'Database error' }, 500);
    }
});

export default app;


