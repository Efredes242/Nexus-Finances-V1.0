
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
        const { email, sub, picture } = payload;

        let user = await c.env.DB.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').bind(sub, email).first();

        if (!user) {
            let username = email.split('@')[0];
            const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
            if (existingUsername) {
                username = `${username}_${sub.slice(-4)}`;
            }

            const id = crypto.randomUUID();
            const dummyPassword = await bcrypt.hash(crypto.randomUUID(), 10);

            await c.env.DB.prepare('INSERT INTO users (id, username, password, email, google_id, role, avatar, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
                .bind(id, username, dummyPassword, email, sub, 'user', picture)
                .run();

            user = { id, username, email, role: 'user', must_change_password: 0, avatar: picture, firstName: null, lastName: null, birthDate: null };
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
    const { name } = await c.req.json();
    if (!name) return c.json({ error: 'Name required' }, 400);

    const partyId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
        // Create Party
        await c.env.DB.prepare('INSERT INTO parties (id, name, created_by, created_at) VALUES (?, ?, ?, ?)')
            .bind(partyId, name, user.id, now).run();

        // Add Creator as Member (Accepted)
        const memberId = crypto.randomUUID();
        await c.env.DB.prepare('INSERT INTO party_members (id, party_id, user_id, status, invited_email, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(memberId, partyId, user.id, 'accepted', user.username, now).run(); // username used as email fallback if needed

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

    try {
        // Check if user exists in DB
        const invitedUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();

        const now = new Date().toISOString();
        const memberId = crypto.randomUUID();
        let targetUserId = invitedUser ? invitedUser.id : null;
        // If user doesn't exist yet, we still store the invite with NULL user_id but VALID invited_email.
        // When they register/login later, we can link it (advanced) or just show it if they exist now.
        // For this version: We assume they MUST exist or we store just email and check on login?
        // Let's store targetUserId if found, otherwise just email. Logic on 'get invitations' will match by email too.

        await c.env.DB.prepare('INSERT INTO party_members (id, party_id, user_id, status, invited_email, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(memberId, partyId, targetUserId, 'pending', email.toLowerCase(), now).run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /parties/invite] Error:', e);
        return c.json({ error: 'Database error' }, 500);
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

        let query = 'SELECT pm.id, p.name as partyName, pm.invited_email FROM party_members pm JOIN parties p ON pm.party_id = p.id WHERE pm.status = ? AND (pm.user_id = ?';
        const params = ['pending', user.id];

        if (email) {
            query += ' OR pm.invited_email = ?';
            params.push(email);
        }
        query += ')';

        const invites = await c.env.DB.prepare(query).bind(...params).all();
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
            SELECT p.* FROM parties p
            JOIN party_members pm ON p.id = pm.party_id
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
            SELECT u.id, u.username, u.email, u.firstName, u.lastName, u.avatar 
            FROM party_members pm 
            LEFT JOIN users u ON pm.user_id = u.id 
            WHERE pm.party_id = ? AND pm.status = 'accepted'
        `).bind(partyId).all();

        return c.json({ expenses: expenses.results, members: members.results });
    } catch (e: any) {
        return c.json({ error: 'Database error' }, 500);
    }
});

// 7. Add Expense
app.post('/api/parties/:id/expenses', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');
    const { description, amount, date, participants, category } = await c.req.json(); // participants = [user_id_1, user_id_2]

    const expenseId = crypto.randomUUID();
    const participantsJson = JSON.stringify(participants || []);

    try {
        await c.env.DB.prepare('INSERT INTO party_expenses (id, party_id, payer_id, amount, description, date, participants, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(expenseId, partyId, user.id, amount, description, date, participantsJson, category).run();

        return c.json({ success: true, expenseId });
    } catch (e: any) {
        return c.json({ error: 'Database error' }, 500);
    }
});

export default app;

