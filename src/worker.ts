
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { logger } from 'hono/logger';
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
app.use('*', logger());
app.use('*', cors({
    origin: (origin) => {
        if (!origin) return null;
        if (origin.endsWith('pages.dev') || origin.endsWith('ezequielfredes.com.ar') || origin.includes('localhost') || origin.startsWith('http://127.0.0.1')) {
            return origin;
        }
        // Origin not in whitelist — reject. Do NOT echo back unknown origins; that defeats CORS.
        return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}));

const getJwtSecret = (c: any): string => {
    const secret = c.env.JWT_SECRET;
    if (!secret) {
        // Fail loud — running without a real secret would let anyone forge tokens.
        throw new Error('JWT_SECRET is not configured. Set it via `wrangler secret put JWT_SECRET`.');
    }
    return secret;
};

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
        // Token expired / signed with rotated secret / malformed → re-authenticate.
        // 401 (not 403) so the frontend's `handleResponse` triggers auto-logout.
        return c.json({ error: 'Invalid or expired token' }, 401);
    }
};

// Admin Middleware - Only allows admin email
const adminMiddleware = async (c: any, next: any) => {
    const user = c.get('user');
    const ADMIN_EMAIL = 'ezequiel.fredes.mondragon@gmail.com';

    // Check if user email matches admin email
    if (user.email !== ADMIN_EMAIL) {
        console.log(`[ADMIN] Access denied for ${user.email}`);
        return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }

    console.log(`[ADMIN] Access granted for ${user.email}`);
    await next();
};

// --- AUTH ROUTES ---

// Google Auth
app.post('/api/auth/google', async (c) => {
    const { credential, accessToken } = await c.req.json();
    console.log('[POST /api/auth/google] Start', { hasCredential: !!credential, hasAccessToken: !!accessToken });
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

            // Auto-approve Super Admin
            const ADMIN_EMAIL = 'ezequiel.fredes.mondragon@gmail.com';
            const isSuperAdmin = email === ADMIN_EMAIL;
            const initialRole = isSuperAdmin ? 'admin' : 'user';
            const initialStatus = isSuperAdmin ? 'APPROVED' : 'PENDING';

            await c.env.DB.prepare('INSERT INTO users (id, username, password, email, google_id, role, avatar, must_change_password, firstName, lastName, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)')
                .bind(id, username, dummyPassword, email, sub, initialRole, picture, firstName, lastName, initialStatus)
                .run();

            user = { id, username, email, role: initialRole, must_change_password: 0, avatar: picture, firstName, lastName, birthDate: null, approval_status: initialStatus };
        } else {
            // @ts-ignore
            if (!user.google_id || !user.avatar) {
                // @ts-ignore
                await c.env.DB.prepare('UPDATE users SET google_id = ?, avatar = ? WHERE id = ?')
                    // @ts-ignore
                    .bind(sub, picture, user.id).run();
            }
        }

        // CHECK APPROVAL STATUS before issuing token
        // @ts-ignore
        const approvalStatus = user.approval_status || 'APPROVED'; // Default to APPROVED for existing users

        if (approvalStatus === 'PENDING') {
            console.log(`[AUTH] User ${email} is pending approval`);
            return c.json({
                approval_status: 'PENDING',
                message: 'Tu solicitud fue enviada al Administrador. Por favor espera 24hs para una devolución por parte del administrador.',
                email: email
            }, 403);
        }

        if (approvalStatus === 'REJECTED') {
            console.log(`[AUTH] User ${email} was rejected`);
            return c.json({
                approval_status: 'REJECTED',
                message: 'Tu solicitud de acceso ha sido denegada. Por favor contacta a soporte para más información.',
                email: email
            }, 403);
        }

        // Update last_login_at
        await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), user.id).run();

        const token = await sign({
            // @ts-ignore
            id: user.id,
            // @ts-ignore
            username: user.username,
            // @ts-ignore
            role: user.role,
            // @ts-ignore
            email: user.email
        }, getJwtSecret(c));

        return c.json({
            token,
            user: {
                // @ts-ignore
                id: user.id,
                // @ts-ignore
                username: user.username,
                // @ts-ignore
                email: user.email,
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
    console.log('[POST /api/login] Attempt for username:', username);

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

// Get All Users (for naming/parsing)
app.get('/api/users', authMiddleware, async (c) => {
    const users = await c.env.DB.prepare('SELECT id, username, role, firstName, lastName, avatar FROM users').all();
    return c.json(users.results);
});

// Get Public Users (Authenticated, for shared expenses naming)
app.get('/api/users/public', authMiddleware, async (c) => {
    const users = await c.env.DB.prepare('SELECT id, username, firstName, lastName, avatar FROM users').all();
    return c.json(users.results);
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
    // Always filter by year to prevent full-table scans that exhaust Worker memory.
    // If the frontend doesn't send a year, default to the current year.
    const year = c.req.query('year') || new Date().getFullYear().toString();

    const results = await c.env.DB.prepare(
        'SELECT *, linked_income_id AS linkedIncomeId FROM entries WHERE user_id = ? AND month_year LIKE ? ORDER BY month_year ASC'
    ).bind(user.id, `${year}-%`).all();

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
    if (!id) {
        console.error('[POST /entries] Missing ID in body');
        return c.json({ error: 'Entry ID is required' }, 400);
    }
    console.log(`[POST /entries] Processing entry ${id} for user ${user.id}`);


    try {
        // Simplified upsert logic
        const exists = await c.env.DB.prepare('SELECT id FROM entries WHERE id = ? AND user_id = ?').bind(id, user.id).first();

        // Sanitize and prepare data for SQL
        const name = body.name || 'Sin nombre';
        const amount = body.amount ?? 0;
        const category = body.category || 'Varios';
        const tag = body.tag || 'General';
        const date = body.date || new Date().toISOString().split('T')[0];
        const paymentMethod = body.paymentMethod || 'Efectivo';
        const status = body.status || 'PENDING';
        const month_year = body.month_year || date.substring(0, 7);
        const cardName = body.cardName || null;
        const financingPlan = body.financingPlan || null;
        const originalAmount = body.originalAmount ?? amount;
        const currency = body.currency || '$';
        const exchangeRateEstimated = body.exchangeRateEstimated ?? 1;
        const exchangeRateActual = body.exchangeRateActual ?? 1;
        const is_provisional = body.is_provisional ? 1 : 0;
        const linked_income_id = body.linkedIncomeId || null;
        const application = body.application || null;

        if (exists) {
            console.log(`[POST /entries] Updating existing entry ${id}`);
            const updateSql = `
                UPDATE entries 
                SET name = ?, amount = ?, category = ?, tag = ?, date = ?, paymentMethod = ?, status = ?, month_year = ?, 
                    cardName = ?, financingPlan = ?, originalAmount = ?, currency = ?, exchangeRateEstimated = ?, 
                    exchangeRateActual = ?, is_provisional = ?, linked_income_id = ?, application = ?
                WHERE id = ? AND user_id = ?
            `;
            const updateBindings = [
                name, amount, category, tag, date, paymentMethod, status, month_year,
                cardName, financingPlan, originalAmount, currency, exchangeRateEstimated,
                exchangeRateActual, is_provisional, linked_income_id, application, id, user.id
            ];
            await c.env.DB.prepare(updateSql).bind(...updateBindings).run();
        } else {
            console.log(`[POST /entries] Inserting new entry ${id}`);
            const insertSql = `
                INSERT INTO entries (
                    id, name, amount, category, tag, date, paymentMethod, status, month_year, 
                    cardName, financingPlan, user_id, originalAmount, currency, exchangeRateEstimated, 
                    exchangeRateActual, is_provisional, linked_income_id, application
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const insertBindings = [
                id, name, amount, category, tag, date, paymentMethod, status, month_year,
                cardName, financingPlan, user.id, originalAmount, currency, exchangeRateEstimated,
                exchangeRateActual, is_provisional, linked_income_id, application
            ];
            await c.env.DB.prepare(insertSql).bind(...insertBindings).run();
        }
        console.error('[POST /entries] Success:', id);
        return c.json({ success: true });
    } catch (error: any) {
        console.error('[POST /entries] DB Error Full:', error);
        console.error('[POST /entries] DB Error Message:', error.message);
        return c.json({ 
            error: `Error de BD: ${error.message}`, 
            details: error.message, 
            fullError: String(error) 
        }, 500);
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
    const cacheUrl = new URL(c.req.url);
    cacheUrl.pathname = `/api/config/${user.id}`;
    const cacheKey = new Request(cacheUrl.toString(), c.req);
    const cache = await caches.open('user-configs');

    let response = await cache.match(cacheKey);
    if (response) {
        return response;
    }

    const row = await c.env.DB.prepare('SELECT * FROM user_configs WHERE user_id = ?').bind(user.id).first();

    if (!row) {
        // Return default config for new users instead of 404
        const defaultResponse = c.json({
            currency: 'ARS',
            categories: {},
            creditCards: []
        });
        defaultResponse.headers.set('Cache-Control', 's-maxage=86400');
        c.executionCtx.waitUntil(cache.put(cacheKey, defaultResponse.clone()));
        return defaultResponse;
    }

    const config = {
        // @ts-ignore
        currency: row.currency || 'ARS',
        // @ts-ignore
        categories: row.categories ? JSON.parse(row.categories) : {},
        // @ts-ignore
        creditCards: row.creditCards ? JSON.parse(row.creditCards) : [],
        // @ts-ignore
        applications: (row.applications && JSON.parse(row.applications as string).length > 0) 
            ? JSON.parse(row.applications as string) 
            : ['BRUBANK', 'SANTANDER RIO', 'MERCADO PAGO', 'GALICIA', 'UALA', 'MACRO', 'PERSONAL PAY', 'BBVA']
    };

    const cJsonResponse = c.json(config);
    cJsonResponse.headers.set('Cache-Control', 's-maxage=86400');
    c.executionCtx.waitUntil(cache.put(cacheKey, cJsonResponse.clone()));

    return cJsonResponse;
});

app.post('/api/config', authMiddleware, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { currency, categories, creditCards, applications } = body;

    try {
        const categoriesJson = JSON.stringify(categories || {});
        const creditCardsJson = JSON.stringify(creditCards || []);
        const applicationsJson = JSON.stringify(applications || []);

        const exists = await c.env.DB.prepare('SELECT 1 FROM user_configs WHERE user_id = ?').bind(user.id).first();

        if (exists) {
            await c.env.DB.prepare('UPDATE user_configs SET currency = ?, categories = ?, creditCards = ?, applications = ? WHERE user_id = ?')
                .bind(currency || '$', categoriesJson, creditCardsJson, applicationsJson, user.id).run();
        } else {
            await c.env.DB.prepare('INSERT INTO user_configs (user_id, currency, categories, creditCards, applications) VALUES (?, ?, ?, ?, ?)')
                .bind(user.id, currency || '$', categoriesJson, creditCardsJson, applicationsJson).run();
        }

        // Invalidate cache
        const cacheUrl = new URL(c.req.url);
        cacheUrl.pathname = `/api/config/${user.id}`;
        const cacheKey = new Request(cacheUrl.toString(), c.req);
        const cache = await caches.open('user-configs');
        c.executionCtx.waitUntil(cache.delete(cacheKey));

        return c.json({ success: true });
    } catch (e: any) {
        console.error('[POST /config] Error:', e);
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
    }
});

app.get('/api/parties/:id/expenses', authMiddleware, async (c) => {
    const { id } = c.req.param();
    const expenses = await c.env.DB.prepare('SELECT * FROM expenses WHERE party_id = ? ORDER BY date DESC').bind(id).all();
    return c.json(expenses.results);
});

// --- INSTALLMENT PLANS ROUTES ---

// Get Party Installment Plans
app.get('/api/parties/:partyId/installments', authMiddleware, async (c) => {
    const { partyId } = c.req.param();
    const plans = await c.env.DB.prepare('SELECT * FROM installment_plans WHERE party_id = ? ORDER BY created_at DESC').bind(partyId).all();

    // Map to include participants correctly and handle legacy
    const enrichedPlans = plans.results.map((plan: any) => {
        let participants = [];
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

// Create Installment Plan (Multi-Participant Support + Currency + Recurring)
app.post('/api/parties/:partyId/installments', authMiddleware, async (c) => {
    const { partyId } = c.req.param();
    const body = await c.req.json();
    const {
        description, total_amount, installments_count, installment_amount,
        payer_id, participants, start_date, currency, exchange_rate,
        is_recurring,
        // Legacy fallbacks
        totalAmount, installments, payerId, participantIds, debtorId, startMonth
    } = body;

    // Use snake_case with camelCase/Legacy fallbacks
    const fDescription = description || body.name;
    const fTotalAmount = total_amount ?? totalAmount;
    const fInstallments = installments_count ?? installments;
    const fPayerId = payer_id ?? payerId;
    const fParticipants = participants || participantIds || (debtorId ? [debtorId] : []);
    const fStartDate = start_date ?? startMonth;
    const fCurrency = currency || 'ARS';
    const fExchangeRate = exchange_rate || body.exchangeRate || 1;
    const fIsRecurring = is_recurring ? 1 : 0;

    if (!fParticipants || fParticipants.length === 0) {
        return c.json({ error: 'At least one participant required' }, 400);
    }

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const participantsJson = JSON.stringify(fParticipants);

    // If installment_amount is NOT provided (Legacy), calculate it using the standard formula.
    // If it IS provided, it means the frontend did special math (e.g., Recurring expenses).
    let finalInstallmentAmount = installment_amount;
    if (finalInstallmentAmount === undefined) {
        const totalPeople = fParticipants.length + 1;
        finalInstallmentAmount = fTotalAmount / (totalPeople * (fInstallments || 1));
    }

    try {
        const user = c.get('user');
        const createdBy = user.id;

        await c.env.DB.prepare(
            'INSERT INTO installment_plans (id, party_id, description, total_amount, installments_count, installment_amount, payer_id, debtor_id, participants, start_date, created_at, created_by, currency, exchange_rate, is_recurring) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
            .bind(id, partyId, fDescription, fTotalAmount, fInstallments, finalInstallmentAmount, fPayerId, fParticipants[0], participantsJson, fStartDate, createdAt, createdBy, fCurrency, fExchangeRate, fIsRecurring)
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
    const {
        description, total_amount, installments_count, installment_amount,
        payer_id, participants, start_date, currency, exchange_rate,
        is_recurring,
        // Legacy fallbacks
        totalAmount, installments, payerId, participantIds, debtorId, startMonth
    } = body;

    // Check ownership
    const existing = await c.env.DB.prepare('SELECT created_by FROM installment_plans WHERE id = ?').bind(id).first();
    if (!existing || (existing.created_by !== user.id && existing.payer_id !== user.id)) {
        return c.json({ error: 'Unauthorized to edit this plan' }, 403);
    }

    const fDescription = description || body.name;
    const fTotalAmount = total_amount ?? totalAmount;
    const fInstallments = installments_count ?? installments;
    const fPayerId = payer_id ?? payerId;
    const fParticipants = participants || participantIds || (debtorId ? [debtorId] : []);
    const fStartDate = start_date ?? startMonth;
    const fCurrency = currency || 'ARS';
    const fExchangeRate = exchange_rate || body.exchangeRate || 1;
    const fIsRecurring = is_recurring ? 1 : 0;

    let finalInstallmentAmount = installment_amount;
    if (finalInstallmentAmount === undefined) {
        const totalPeople = fParticipants.length + 1;
        finalInstallmentAmount = fTotalAmount / (totalPeople * (fInstallments || 1));
    }

    const participantsJson = JSON.stringify(fParticipants);

    try {
        await c.env.DB.prepare(
            'UPDATE installment_plans SET description = ?, total_amount = ?, installments_count = ?, installment_amount = ?, payer_id = ?, debtor_id = ?, participants = ?, start_date = ?, currency = ?, exchange_rate = ?, is_recurring = ? WHERE id = ?'
        )
            .bind(fDescription, fTotalAmount, fInstallments, finalInstallmentAmount, fPayerId, fParticipants[0], participantsJson, fStartDate, fCurrency, fExchangeRate, fIsRecurring, id)
            .run();

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: 'Failed to update plan', details: error.message }, 500);
    }
});

// Delete Installment Plan — must be a member of the party that owns the plan
app.delete('/api/parties/:partyId/installments/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const { partyId, id } = c.req.param();

    // Verify the plan belongs to the party AND the user is a member of that party.
    const planRow = await c.env.DB.prepare(
        'SELECT party_id FROM installment_plans WHERE id = ?'
    ).bind(id).first() as { party_id?: string } | null;
    if (!planRow) return c.json({ error: 'Plan not found' }, 404);
    if (planRow.party_id !== partyId) return c.json({ error: 'Plan does not belong to this party' }, 403);

    const membership = await c.env.DB.prepare(
        "SELECT id FROM party_members WHERE party_id = ? AND user_id = ? AND status = 'accepted'"
    ).bind(partyId, user.id).first();
    if (!membership) return c.json({ error: 'Forbidden: not a member of this party' }, 403);

    await c.env.DB.prepare('DELETE FROM installment_plans WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

app.get('/api/installments', authMiddleware, async (c) => {
    const user = c.get('user');
    const res = await c.env.DB.prepare('SELECT *, linked_income_id AS linkedIncomeId FROM installments WHERE user_id = ?').bind(user.id).all();
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
            await c.env.DB.prepare('UPDATE installments SET name=?, totalAmount=?, installments=?, startDate=?, description=?, category=?, cardName=?, linked_income_id=?, application=? WHERE id=? AND user_id=?')
                .bind(name, totalAmount, installments, startDate, description, category, cardName, body.linkedIncomeId || null, body.application || null, id, user.id).run();
        } else {
            await c.env.DB.prepare('INSERT INTO installments (id, name, totalAmount, installments, startDate, description, category, cardName, linked_income_id, application, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .bind(id, name, totalAmount, installments, startDate, description, category, cardName, body.linkedIncomeId || null, body.application || null, user.id).run();
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
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
    const { name } = await c.req.json();
    const user = c.get('user');
    const partyId = c.req.param('id');
    console.log('[POST /api/parties/:id/guests] Start', { partyId, guestName: name, userId: user?.id });

    try {
        // Verify creator permission? Or any member? Let's say any member for now for ease.
        const membership = await c.env.DB.prepare('SELECT status FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?')
            .bind(partyId, user.id, 'accepted').first();
        if (!membership) return c.json({ error: 'Not a member' }, 403);

        const now = new Date().toISOString();
        const memberId = crypto.randomUUID();
        // Insert guest
        // user_id is NULL for guests.
        await c.env.DB.prepare('INSERT INTO party_members (id, party_id, user_id, status, is_guest, guest_name, joined_at) VALUES (?, ?, NULL, ?, 1, ?, ?)')
            .bind(memberId, partyId, 'accepted', name, now).run();

        return c.json({ success: true, memberId });
    } catch (e: any) {
        return c.json({ error: 'Database error: ' + e.message }, 500);
    }
});

// DEBUG: Get Users List — admin only
app.get('/api/debug/users', authMiddleware, adminMiddleware, async (c) => {
    try {
        const users = await c.env.DB.prepare('SELECT id, username, email, avatar FROM users LIMIT 100').all();
        return c.json(users.results);
    } catch (e) {
        return c.json({ error: 'Failed to fetch users' }, 500);
    }
});

// DEBUG: Get Pending Invitations List — admin only
app.get('/api/debug/invitations', authMiddleware, adminMiddleware, async (c) => {
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
        console.log(`[GET /api/invitations] START - User: ${user.id}`);

        // Fetch full user to get email with error handling
        let email = null;
        try {
            const fullUser = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(user.id).first();
            // @ts-ignore
            email = fullUser?.email || null;
            console.log(`[GET /api/invitations] User email: ${email}`);
        } catch (emailErr) {
            console.error('[GET /api/invitations] Error fetching user email:', emailErr);
            // Continue without email
        }

        let query = 'SELECT pm.id, p.name as partyName, pm.invited_email FROM party_members pm JOIN parties p ON pm.party_id = p.id WHERE pm.status = ? AND (pm.user_id = ?';
        const params = ['pending', user.id];

        if (email) {
            query += ' OR LOWER(TRIM(pm.invited_email)) = LOWER(TRIM(?))';
            params.push(email);
        }
        query += ')';

        console.log(`[GET /api/invitations] Executing query...`);
        const invites = await c.env.DB.prepare(query).bind(...params).all();
        console.log(`[GET /api/invitations] SUCCESS - Found ${invites.results?.length || 0} invites`);

        return c.json(invites.results || []);
    } catch (e: any) {
        console.error('[GET /api/invitations] FATAL Error:', e.message, e.stack);
        return c.json({ error: 'Database error', details: e.message }, 500);
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
    }
});

// 5. Get My Parties
app.get('/api/parties', authMiddleware, async (c) => {
    const user = c.get('user');
    try {
        console.log(`[GET /api/parties] START - User: ${user.id}`);

        const parties = await c.env.DB.prepare(`
            SELECT p.*, u.username as creator_name,
            (SELECT COUNT(*) FROM pending_approvals pa WHERE pa.party_id = p.id AND pa.status = 'PENDING') as pending_count
            FROM parties p
            JOIN party_members pm ON p.id = pm.party_id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE pm.user_id = ? AND pm.status = 'accepted'
                `).bind(user.id).all();

        console.log(`[GET /api/parties] SUCCESS - Found ${parties.results?.length || 0} parties`);
        return c.json(parties.results || []);
    } catch (e: any) {
        console.error('[GET /api/parties] FATAL Error:', e.message, e.stack);
        return c.json({ error: 'Database error', details: e.message }, 500);
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
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
                SET description =?, amount =?, date =?, participants =?, category =?, installments_count =?, card_name =?, first_payment_date =?
                WHERE id =?
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
    }
});

// 8. Delete Party Expense
app.delete('/api/parties/:partyId/expenses/:expenseId', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const partyId = c.req.param('partyId');
        const expenseId = c.req.param('expenseId');

        console.log(`[DELETE] Request: Party ${partyId}, Expense ${expenseId}, User ${user.id} `);

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
            console.log(`[DELETE] Unauthorized.Payer: ${expense.payer_id}, Creator: ${party?.created_by}, User: ${user.id} `);
            return c.json({ error: 'Unauthorized: You are not the payer or party creator' }, 403);
        }

        await c.env.DB.prepare('DELETE FROM party_expenses WHERE id = ?').bind(expenseId).run();
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[DELETE] Error:', e);
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
    }
});

// --- INTEGRITY SYSTEM (APPROVALS) ROUTES ---

// 9. Get Pending Approvals
app.get('/api/parties/:id/approvals', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');
    try {
        const approvals = await c.env.DB.prepare(`
            SELECT pa.*, u.username as requester_name 
            FROM pending_approvals pa
            JOIN users u ON pa.requester_id = u.id
            WHERE pa.party_id = ? AND pa.status = 'PENDING'
            ORDER BY pa.created_at DESC
        `).bind(partyId).all();
        return c.json(approvals.results);
    } catch (e: any) {
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

// 10. Create Approval Request
app.post('/api/parties/:id/approvals', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');
    const { target_expense_id, action_type, data_payload, reason } = await c.req.json();

    const approvalId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
        await c.env.DB.prepare(`
            INSERT INTO pending_approvals (id, party_id, requester_id, target_expense_id, action_type, data_payload, reason, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
        `).bind(approvalId, partyId, user.id, target_expense_id, action_type, JSON.stringify(data_payload), reason, createdAt).run();

        return c.json({ success: true, approvalId });
    } catch (e: any) {
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

// 11. Decide Approval (Approve/Reject)
app.post('/api/parties/:id/approvals/:approvalId/decide', authMiddleware, async (c) => {
    const user = c.get('user');
    const partyId = c.req.param('id');
    const approvalId = c.req.param('approvalId');
    const { decision } = await c.req.json(); // 'APPROVED' or 'REJECTED'

    try {
        const approval = await c.env.DB.prepare('SELECT * FROM pending_approvals WHERE id = ?').bind(approvalId).first();
        if (!approval) return c.json({ error: 'Approval request not found' }, 404);

        if (decision === 'REJECTED') {
            await c.env.DB.prepare("UPDATE pending_approvals SET status = 'REJECTED' WHERE id = ?").bind(approvalId).run();
            return c.json({ success: true, status: 'REJECTED' });
        }

        if (decision === 'APPROVED') {
            // EXECUTE ACTION
            if (approval.action_type === 'DELETE') {
                // Try deleting from both, one will succeed or both if somehow linked
                await c.env.DB.prepare('DELETE FROM party_expenses WHERE id = ?').bind(approval.target_expense_id).run();
                await c.env.DB.prepare('DELETE FROM installment_plans WHERE id = ?').bind(approval.target_expense_id).run();
            } else if (approval.action_type === 'EDIT') {
                const payload = JSON.parse(approval.data_payload as string);

                if (payload.installmentData) {
                    // Update installment_plans table
                    const fDescription = payload.description || payload.name;
                    const fTotalAmount = payload.total_amount ?? payload.amount;
                    const fInstallments = payload.installments_count ?? (payload.installmentData?.installments || 1);
                    const fPayerId = payload.payer_id ?? payload.payerId;
                    const fParticipants = payload.participants || [];
                    const fStartDate = payload.start_date ?? payload.date;
                    const fCurrency = payload.currency || 'ARS';
                    const fExchangeRate = payload.exchange_rate || 1;
                    const fIsRecurring = payload.is_recurring ? 1 : 0;
                    const participantsJson = JSON.stringify(fParticipants);

                    // Re-calculate installment amount if needed
                    let finalInstallmentAmount = payload.installment_amount;
                    if (finalInstallmentAmount === undefined) {
                        const totalPeople = fParticipants.length + 1;
                        finalInstallmentAmount = fTotalAmount / (totalPeople * (fInstallments || 1));
                    }

                    const fDebtorId = fParticipants[0] || '';

                    await c.env.DB.prepare(`
                        UPDATE installment_plans 
                        SET description = ?, total_amount = ?, installments_count = ?, installment_amount = ?, payer_id = ?, debtor_id = ?, participants = ?, start_date = ?, currency = ?, exchange_rate = ?, is_recurring = ?
                        WHERE id = ?
                    `).bind(fDescription, fTotalAmount, fInstallments, finalInstallmentAmount, fPayerId, fDebtorId, participantsJson, fStartDate, fCurrency, fExchangeRate, fIsRecurring, approval.target_expense_id).run();

                } else {
                    // Update party_expenses table
                    const description = payload.description || payload.name;
                    const amount = payload.amount !== undefined ? payload.amount : payload.total_amount;
                    const date = payload.date || payload.start_date;
                    const { participants, category } = payload;

                    const participantsJson = JSON.stringify(participants || []);

                    await c.env.DB.prepare(`
                        UPDATE party_expenses 
                        SET description =?, amount =?, date =?, participants =?, category =?, installments_count = 1, card_name = NULL, first_payment_date = NULL
                        WHERE id =?
                    `).bind(description, amount, date, participantsJson, category || null, approval.target_expense_id).run();
                }
            }

            await c.env.DB.prepare("UPDATE pending_approvals SET status = 'APPROVED' WHERE id = ?").bind(approvalId).run();
            return c.json({ success: true, status: 'APPROVED' });
        }

        return c.json({ error: 'Invalid decision' }, 400);

    } catch (e: any) {
        console.error('[POST /decide] Error:', e);
        return c.json({ error: 'Database error', details: e.message }, 500);
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
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
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
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
            INSERT INTO member_nicknames(id, user_id, party_id, member_id, nickname)
            VALUES(?, ?, ?, ?, ?)
            ON CONFLICT(user_id, party_id, member_id) 
            DO UPDATE SET nickname = excluded.nickname
                `).bind(nicknameId, user.id, partyId, memberId, nickname.trim()).run();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('[PUT /parties/nicknames] Error:', e);
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
    }
});

// ============================================
// ADMIN ROUTES - User Approval System
// ============================================

// Get all users (Admin only)
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (c) => {
    try {
        console.log('[GET /api/admin/users] Fetching all users');

        const users = await c.env.DB.prepare(`
            SELECT 
                id,
                username,
                email,
                role,
                approval_status,
                created_at,
                last_login_at,
                avatar,
                firstName,
                lastName,
                google_id
            FROM users
            ORDER BY last_login_at DESC, created_at DESC
        `).all();

        return c.json({ users: users.results || [] });
    } catch (e: any) {
        console.error('[GET /api/admin/users] Error:', e);
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

// Get pending users count (Admin only)
app.get('/api/admin/pending-count', authMiddleware, adminMiddleware, async (c) => {
    try {
        const result = await c.env.DB.prepare(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE approval_status = 'PENDING'
            `).first();

        // @ts-ignore
        return c.json({ count: result?.count || 0 });
    } catch (e: any) {
        console.error('[GET /api/admin/pending-count] Error:', e);
        return c.json({ error: 'Database error', details: e instanceof Error ? e.message : String(e) }, 500);
    }
});

// Change user role (Admin only) — toggle entre 'admin' y 'user'
app.put('/api/admin/users/:userId/role', authMiddleware, adminMiddleware, async (c) => {
    const userId = c.req.param('userId');
    const admin = c.get('user');

    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

    const role = body?.role;
    const ALLOWED_ROLES = ['admin', 'user'];
    if (!ALLOWED_ROLES.includes(role)) {
        return c.json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` }, 400);
    }

    // Defensa básica: el super-admin nunca debería poder degradarse a user a sí mismo
    // por error y quedarse sin acceso al panel. Bloqueo explícito.
    if (admin.id === userId && role !== 'admin') {
        return c.json({ error: 'No podés cambiar tu propio rol de admin' }, 403);
    }

    try {
        const exists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
        if (!exists) return c.json({ error: 'User not found' }, 404);

        await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
        console.log(`[PUT /api/admin/users/${userId}/role] role=${role} by ${admin.email}`);
        return c.json({ success: true, role });
    } catch (e: any) {
        console.error(`[PUT /api/admin/users/${userId}/role] Error:`, e);
        return c.json({ error: 'Database error' }, 500);
    }
});

// Approve user (Admin only)
app.post('/api/admin/users/:userId/approve', authMiddleware, adminMiddleware, async (c) => {
    const userId = c.req.param('userId');
    const admin = c.get('user');
    const now = new Date().toISOString();

    try {
        console.log(`[POST / api / admin / users / ${userId}/approve]Admin: ${admin.email} `);

        // Check if user exists
        const user = await c.env.DB.prepare('SELECT id, email, approval_status FROM users WHERE id = ?')
            .bind(userId).first();

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Update approval status
        await c.env.DB.prepare(`
            UPDATE users 
            SET approval_status = 'APPROVED',
            approval_decision_at = ?,
            approval_decision_by = ?
                WHERE id = ?
                    `).bind(now, admin.id, userId).run();

        console.log(`[POST / api / admin / users / ${userId}/approve] User approved successfully`);

        return c.json({
            success: true,
            message: 'User approved successfully',
            // @ts-ignore
            userEmail: user.email
        });
    } catch (e: any) {
        console.error(`[POST / api / admin / users / ${userId}/approve]Error: `, e);
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

// Reject user (Admin only)
app.post('/api/admin/users/:userId/reject', authMiddleware, adminMiddleware, async (c) => {
    const userId = c.req.param('userId');
    const admin = c.get('user');
    const now = new Date().toISOString();

    try {
        console.log(`[POST / api / admin / users / ${userId}/reject]Admin: ${admin.email} `);

        // Check if user exists
        const user = await c.env.DB.prepare('SELECT id, email, approval_status FROM users WHERE id = ?')
            .bind(userId).first();

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Update approval status
        await c.env.DB.prepare(`
            UPDATE users 
            SET approval_status = 'REJECTED',
            approval_decision_at = ?,
            approval_decision_by = ?
                WHERE id = ?
                    `).bind(now, admin.id, userId).run();

        console.log(`[POST / api / admin / users / ${userId}/reject] User rejected successfully`);

        return c.json({
            success: true,
            message: 'User rejected successfully',
            // @ts-ignore
            userEmail: user.email
        });
    } catch (e: any) {
        console.error(`[POST / api / admin / users / ${userId}/reject]Error: `, e);
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

// Delete user (Admin only) - Completely remove from system
app.delete('/api/admin/users/:userId', authMiddleware, adminMiddleware, async (c) => {
    const userId = c.req.param('userId');
    const admin = c.get('user');

    try {
        console.log(`[DELETE / api / admin / users / ${userId}]Admin: ${admin.email} `);

        // Check if user exists
        const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE id = ?')
            .bind(userId).first();

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Prevent admin from deleting themselves
        if (userId === admin.id) {
            return c.json({ error: 'Cannot delete your own admin account' }, 400);
        }

        // 1. Delete Installment Plans (Foreign Key Constraint) - Only where user is critical (Payer/Debtor)
        try {
            await c.env.DB.prepare('DELETE FROM installment_plans WHERE payer_id = ? OR debtor_id = ?')
                .bind(userId, userId).run();
        } catch (err: any) {
            console.error(`[DELETE USER ${userId}] Failed to delete installments:`, err);
            // Continue? If FK constraint, it will fail. If column missing, it might work if we are lucky with schema version.
            // But we should probably throw to inform user.
            throw new Error(`Failed to delete installments: ${err.message}`);
        }

        // 2. Delete Memberships (Clean up)
        try {
            await c.env.DB.prepare('DELETE FROM party_members WHERE user_id = ?').bind(userId).run();
        } catch (err: any) {
            console.error(`[DELETE USER ${userId}] Failed to delete memberships:`, err);
            throw new Error(`Failed to delete memberships: ${err.message}`);
        }

        // 3. Delete Pending Approvals (Cascading checks)
        try {
            // "target_owner_id" does not exist in schema 0002. Only requester_id.
            // Also, requester_id has ON DELETE CASCADE in schema, but we manual delete to be safe.
            await c.env.DB.prepare('DELETE FROM pending_approvals WHERE requester_id = ?').bind(userId).run();
        } catch (err: any) {
            console.error(`[DELETE USER ${userId}] Failed to delete approvals:`, err);
            // Verify if table exists warning (optional)
            // Verify if table exists error? If so, ignore.
            if (!err.message.includes('no such table')) {
                throw new Error(`Failed to delete approvals: ${err.message}`);
            }
        }

        // 4. Delete Expenses paid by user (Cascade - Destructive but necessary for FK constraints)
        try {
            await c.env.DB.prepare('DELETE FROM party_expenses WHERE payer_id = ?').bind(userId).run();
        } catch (err: any) {
            console.error(`[DELETE USER ${userId}] Failed to delete expenses:`, err);
            if (!err.message.includes('no such table')) {
                throw new Error(`Failed to delete expenses: ${err.message}`);
            }
        }

        // 5. Delete Parties created by user (Cascade - Removes entire groups)
        try {
            await c.env.DB.prepare('DELETE FROM parties WHERE created_by = ?').bind(userId).run();
        } catch (err: any) {
            console.error(`[DELETE USER ${userId}] Failed to delete parties:`, err);
            throw new Error(`Failed to delete parties: ${err.message}`);
        }

        // 0. Delete Personal Finance Data (Entries, Goals, Budgets, User Configs)
        const personalTables = ['entries', 'goals', 'installments', 'user_configs', 'category_budgets'];
        for (const table of personalTables) {
            try {
                await c.env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId).run();
            } catch (err: any) {
                console.error(`[DELETE USER ${userId}] Failed to delete from ${table}:`, err);
                if (!err.message.includes('no such table')) {
                    // Log but continue? No, if FK exists it will block user delete.
                    // But if we fail to delete here, we should probably stop.
                    throw new Error(`Failed to delete from ${table}: ${err.message}`);
                }
            }
        }

        // 6. Delete User
        try {
            await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
        } catch (err: any) {
            console.error(`[DELETE USER ${userId}] Failed to delete user record:`, err);

            // Debugging FK constraint: Find which tables reference users
            let refInfo = "Unknown";
            try {
                const references = await c.env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE sql LIKE '%REFERENCES users%'").all();
                refInfo = JSON.stringify(references.results);
            } catch (e) {
                refInfo = "Could not fetch schema";
            }

            throw new Error(`Failed to delete user record: ${err.message}. Active FK References: ${refInfo}`);
        }

        console.log(`[DELETE / api / admin / users / ${userId}] User deleted successfully`);

        return c.json({
            success: true,
            message: 'User deleted successfully',
            // @ts-ignore
            userEmail: user.email
        });
    } catch (e: any) {
        console.error(`[DELETE / api / admin / users / ${userId}]Error: `, e);
        return c.json({ error: 'Database error', details: e.message }, 500);
    }
});

export default app;



