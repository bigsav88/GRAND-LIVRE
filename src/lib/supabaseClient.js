import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes. ' +
    'Vérifie que le fichier .env.local existe à la racine du projet et redémarre `npm run dev`.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
