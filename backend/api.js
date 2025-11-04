import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import cookieParser from 'cookie-parser';

// Load environment variables (Vercel will inject these in production)
dotenv.config();

// --- Supabase Client Initialization ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ ERROR: Supabase env vars are missing!");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log("✅ Supabase client initialized.");

// --- Express App Setup ---
const app = express();

// --- 1. CONFIGURE CORS FOR VERCEL ---
// This dynamically sets the allowed origin
const allowedOrigin = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` // Vercel's production URL
    : 'http://127.0.0.1:5500';           // Your local dev environment
    
app.use(cors({
    origin: allowedOrigin, 
    credentials: true 
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

console.log("✅ Express middleware configured.");

// --- Middleware: Verify JWT from Cookie & Admin Role ---
async function authenticate(req, res, next) {
    // ... (This function remains exactly the same as before) ...
    console.log(`🔑 Admin authentication attempt for: ${req.path}`);
    const token = req.cookies.token; 
    if (!token) {
      console.warn("🚫 Auth failed: Missing token cookie.");
      return res.status(401).json({ error: 'Missing token' });
    }
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.warn("🚫 Auth failed: Invalid token.", authError?.message);
        res.clearCookie('token');
        return res.status(401).json({ error: 'Invalid token' });
      }
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('supabase_id', user.id) // ⚠️ Make sure 'supabase_id' is correct!
        .single();
      if (profileError || !profile) {
          console.warn(`🚫 Auth success, but profile fetch failed.`, profileError);
          return res.status(403).json({ error: 'User profile not found.' });
      }
      if (profile.role !== 'admin') {
          console.warn(`🚫 Access Denied: User ${user.email} is not an admin.`);
          return res.status(403).json({ error: 'Access Denied: Not an administrator.' });
      }
      req.user = user; 
      console.log(`✅ Admin user authenticated: ${user.email}`);
      next();
    } catch (catchError) {
         console.error("💥 Unexpected error in authenticate middleware:", catchError);
         return res.status(500).json({ error: 'Internal server error' });
    }
}

// --- PUBLIC AUTH ROUTES ---

// POST /login
app.post('/login', async (req, res) => {
    // ... (Your existing /login route code)
    const { email, password } = req.body;
    try {
        const { data: sessionData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) return res.status(401).json({ error: authError.message });

        const user = sessionData.user;
        const token = sessionData.session.access_token;

        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('role')
            .eq('supabase_id', user.id) 
            .single();

        if (profileError || !profile) return res.status(403).json({ error: 'Profile not found.' });
        if (profile.role !== 'admin') return res.status(403).json({ error: 'Not an administrator.' });

        // --- 2. UPDATE COOKIE FOR PRODUCTION ---
        res.cookie('token', token, {
            httpOnly: true,
            secure: true, // ALWAYS true for Vercel/production (it runs on HTTPS)
            sameSite: 'Lax', // 'Lax' is safer for cross-site redirects
            maxAge: sessionData.session.expires_in * 1000,
            path: '/'
        });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("💥 Error in POST /login:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /logout
app.post('/logout', (req, res) => {
    // ... (Your existing /logout route code)
    res.cookie('token', '', {
        httpOnly: true,
        secure: true, // ALWAYS true for Vercel/production
        sameSite: 'Lax',
        expires: new Date(0),
        path: '/'
    });
    res.status(200).json({ success: true, message: 'Logged out.' });
});

// --- PUBLIC STOREFRONT ROUTE ---

// GET /products
app.get('/products', async (req, res) => {
    // ... (Your existing public /products route code) ...
    console.log(`➡️ GET /products (Public Access)`);
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('status', 'active') 
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error("💥 Error in public GET /products:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- PROTECTED ADMIN API ROUTES ---
// (No changes needed to the logic inside these routes)

// GET /api/products (Admin)
app.get('/api/products', authenticate, async (req, res) => {
    // ... (Your existing admin /api/products route code)
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/products (Admin)
app.post('/api/products', authenticate, async (req, res) => {
    // ... (Your existing admin /api/products route code)
    const { name, description, status, images, price } = req.body;
    const { data, error } = await supabase.from('products').insert({ name, description, status, images, price }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// PUT /api/products/:id (Admin)
app.put('/api/products/:id', authenticate, async (req, res) => {
    // ... (Your existing admin /api/products/:id route code)
    const { id } = req.params;
    const { name, description, status, images, price } = req.body;
    const { data, error } = await supabase.from('products').update({ name, description, status, images, price, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
});

// DELETE /api/products/:id (Admin)
app.delete('/api/products/:id', authenticate, async (req, res) => {
    // ... (Your existing admin /api/products/:id route code)
    const { id } = req.params;
    const { error, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
});

// GET /api/overview (Admin)
app.get('/api/overview', authenticate, async (req, res) => {
    // ... (Your existing admin /api/overview route code)
    const { data, error } = await supabase.from('products').select('status, images, created_at, updated_at');
    if (error) return res.status(500).json({ error: error.message });
    // ... (Your stats calculation logic)
    const totalProducts = data.length;
    const activeProducts = data.filter(p => p.status === 'active').length;
    const totalImages = data.reduce((sum, p) => sum + (Array.isArray(p.images) ? p.images.length : 0), 0);
    let lastUpdated = null;
    if (data.length > 0) { /* ... (your date logic) ... */ }
    res.json({ totalProducts, activeProducts, totalImages, lastUpdated });
});


// --- 3. REMOVE app.listen() ---
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 Backend server (with HttpOnly cookies) running on http://localhost:${PORT}`);
// });

// --- 4. EXPORT THE APP for Vercel ---
export default app;