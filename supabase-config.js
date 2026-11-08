/* =========================================================
   Glória em Movimento — configuração do Supabase
   A URL e a chave abaixo são seguras para ficar no navegador:
   a "anon key" só tem os privilégios que as políticas de Row
   Level Security (RLS) do schema.sql permitem — ela não dá
   acesso irrestrito ao banco. NUNCA coloque aqui a "service_role"
   / "secret key": essa dá acesso total e só pode existir num
   servidor, nunca no código do navegador.
   ========================================================= */
const SUPABASE_URL = 'https://qnshqjwjdjeneusfvwbr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuc2hxandqZGplbmV1c2Z2d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNTQzNTQsImV4cCI6MjEwMTczMDM1NH0.8Jy-ceI3BZVhju2RXEhx0HWQ9GGC4f5z63uy_Pz2wPA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
