// Configuración de Supabase — NeoVenta POS
// La anon key es pública por diseño; la seguridad real son las
// políticas RLS del esquema (supabase/schema.sql).
const SUPABASE_URL = 'https://gfqecprnbrknnhcpdwob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmcWVjcHJuYnJrbm5oY3Bkd29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NjY3MDMsImV4cCI6MjA5NjI0MjcwM30.Z14eHtQ0qi5PtOnz7uN6J3iLJtTJSD4SBj7qsSMmbxw';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Segundo cliente SIN persistir sesión: permite al admin registrar
// usuarios nuevos sin que signUp reemplace su propia sesión activa.
const _supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

// Correo de soporte que ven tus clientes (ícono de audífonos en
// el menú). Pon aquí tu correo; si queda vacío el ícono no sale.
const SOPORTE_CORREO = '';
