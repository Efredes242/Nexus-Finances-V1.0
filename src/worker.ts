
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
    const { credential } = await c.req.json();
    if (!credential) return c.json({ error: 'Credential required' }, 400);

    try {
        // Verify with Google REST API (Worker Compatible)
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (!googleRes.ok) {
            return c.json({ error: 'Invalid Google Token' }, 401);
        }
        const payload = await googleRes.json();
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
        user: {
            ...updatedUser,
            // @ts-ignore
            must_change_password: !!updatedUser.must_change_password
        }
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
    const body = await c.req.json();
    const { id } = body; // Assume full object in body

    // Simplified upsert logic
    const exists = await c.env.DB.prepare('SELECT id FROM entries WHERE id = ? AND user_id = ?').bind(id, user.id).first();

    if (exists) {
        await c.env.DB.prepare(`
       UPDATE entries 
       SET name=?, amount=?, category=?, tag=?, date=?, paymentMethod=?, status=?, month_year=?, cardName=?, financingPlan=?, originalAmount=?, currency=?, exchangeRateEstimated=?, exchangeRateActual=?, is_provisional=?
       WHERE id=? AND user_id=?
     `).bind(
            body.name, body.amount, body.category, body.tag, body.date, body.paymentMethod, body.status, body.month_year,
            body.cardName, body.financingPlan, body.originalAmount, body.currency, body.exchangeRateEstimated, body.exchangeRateActual, body.is_provisional ? 1 : 0,
            id, user.id
        ).run();
    } else {
        await c.env.DB.prepare(`
       INSERT INTO entries (id, name, amount, category, tag, date, paymentMethod, status, month_year, cardName, financingPlan, user_id, originalAmount, currency, exchangeRateEstimated, exchangeRateActual, is_provisional)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
            id, body.name, body.amount, body.category, body.tag, body.date, body.paymentMethod, body.status, body.month_year,
            body.cardName, body.financingPlan, user.id, body.originalAmount, body.currency, body.exchangeRateEstimated, body.exchangeRateActual, body.is_provisional ? 1 : 0
        ).run();
    }
    return c.json({ success: true });
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
    const { id, name, targetAmount, currentAmount, deadline, icon } = await c.req.json();

    const exists = await c.env.DB.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').bind(id, user.id).first();
    if (exists) {
        await c.env.DB.prepare('UPDATE goals SET name=?, targetAmount=?, currentAmount=?, deadline=?, icon=? WHERE id=? AND user_id=?')
            .bind(name, targetAmount, currentAmount, deadline, icon, id, user.id).run();
    } else {
        await c.env.DB.prepare('INSERT INTO goals (id, name, targetAmount, currentAmount, deadline, icon, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(id, name, targetAmount, currentAmount, deadline, icon, user.id).run();
    }
    return c.json({ success: true });
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
    // @ts-ignore
    let config = await c.env.DB.prepare('SELECT * FROM user_configs WHERE user_id = ?').bind(user.id).first();

    if (!config) {
        config = {
            user_id: user.id,
            currency: 'ARS',
            categories: JSON.stringify({
                ingresos: ['Sueldo', 'Ventas', 'Otros'],
                gastos: ['Alquiler', 'Comida', 'Servicios', 'Transporte', 'Salud', 'Ocio']
            }),
            creditCards: JSON.stringify([])
        };
    }

    // Parse JSON fields
    // @ts-ignore
    if (typeof config.categories === 'string') {
        try {
            // @ts-ignore
            config.categories = JSON.parse(config.categories);
        } catch (e) { }
    }
    // @ts-ignore
    if (typeof config.creditCards === 'string') {
        try {
            // @ts-ignore
            config.creditCards = JSON.parse(config.creditCards);
        } catch (e) { }
    }

    return c.json(config);
});

app.post('/api/config', authMiddleware, async (c) => {
    const user = c.get('user');
    const { currency, categories, creditCards } = await c.req.json();

    const categoriesJson = JSON.stringify(categories);
    const creditCardsJson = JSON.stringify(creditCards || []);

    const exists = await c.env.DB.prepare('SELECT user_id FROM user_configs WHERE user_id = ?').bind(user.id).first();

    if (exists) {
        await c.env.DB.prepare('UPDATE user_configs SET currency=?, categories=?, creditCards=? WHERE user_id=?')
            .bind(currency, categoriesJson, creditCardsJson, user.id).run();
    } else {
        await c.env.DB.prepare('INSERT INTO user_configs (user_id, currency, categories, creditCards) VALUES (?, ?, ?, ?)')
            .bind(user.id, currency, categoriesJson, creditCardsJson).run();
    }
    return c.json({ success: true });
});

export default app;
