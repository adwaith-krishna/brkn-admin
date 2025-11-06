import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import cookieParser from 'cookie-parser';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("ERROR: Supabase env vars are missing!");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log("Supabase client initialized.");


const app = express();


const allowedOrigin = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://127.0.0.1:5500';          
    
app.use(cors({
    origin: allowedOrigin, 
    credentials: true 
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

console.log("Express middleware configured.");

async function authenticate(req, res, next) {
 
    console.log(`🔑 Admin authentication attempt for: ${req.path}`);
    const token = req.cookies.token; 
    if (!token) {
      console.warn("Auth failed: Missing token cookie.");
      return res.status(401).json({ error: 'Missing token' });
    }
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.warn("Auth failed: Invalid token.", authError?.message);
        res.clearCookie('token');
        return res.status(401).json({ error: 'Invalid token' });
      }
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('supabase_id', user.id) 
        .single();
      if (profileError || !profile) {
          console.warn(`Auth success, but profile fetch failed.`, profileError);
          return res.status(403).json({ error: 'User profile not found.' });
      }
      if (profile.role !== 'admin') {
          console.warn(`Access Denied: User ${user.email} is not an admin.`);
          return res.status(403).json({ error: 'Access Denied: Not an administrator.' });
      }
      req.user = user; 
      console.log(`Admin user authenticated: ${user.email}`);
      next();
    } catch (catchError) {
         console.error("Unexpected error in authenticate middleware:", catchError);
         return res.status(500).json({ error: 'Internal server error' });
    }
}


app.post('/login', async (req, res) => {
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


        res.cookie('token', token, {
            httpOnly: true,
            secure: true, 
            sameSite: 'Lax', 
            maxAge: sessionData.session.expires_in * 1000,
            path: '/'
        });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("💥 Error in POST /login:", error);
        res.status(500).json({ error: error.message });
    }
});


app.post('/logout', (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        secure: true, 
        sameSite: 'Lax',
        expires: new Date(0),
        path: '/'
    });
    res.status(200).json({ success: true, message: 'Logged out.' });
});


app.get('/products', async (req, res) => {

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


app.get('/api/products', authenticate, async (req, res) => {

    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});


app.post('/api/products', authenticate, async (req, res) => {
    const { name, description, status, images, price } = req.body;
    const { data, error } = await supabase.from('products').insert({ name, description, status, images, price }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});


app.put('/api/products/:id', authenticate, async (req, res) => {
  
    const { id } = req.params;
    const { name, description, status, images, price } = req.body;
    const { data, error } = await supabase.from('products').update({ name, description, status, images, price, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
});

app.delete('/api/products/:id', authenticate, async (req, res) => {
  
    const { id } = req.params;
    const { error, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
});


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


export default app;
