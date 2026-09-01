import { supabase } from './supabaseClient';

// ============================================================================
// AUTH
// ============================================================================
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session)
  );
  return data.subscription;
}

// ============================================================================
// PRÉFÉRENCES (salaire, cibles 50/30/20, statut d'onboarding)
// ============================================================================
export async function getPreferences() {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updatePreferences(patch) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('user_preferences')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) throw error;
}

// ============================================================================
// CATÉGORIES & SOUS-CATÉGORIES
// ============================================================================
export async function getCategories() {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*, budget_subcategories(*)')
    .is('archived_at', null)
    .order('created_at');
  if (error) throw error;
  // Filtre aussi les sous-catégories archivées, et trie pour un ordre stable
  return data.map((c) => ({
    ...c,
    budget_subcategories: (c.budget_subcategories || [])
      .filter((s) => !s.archived_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));
}

export async function addCategory({ type, name, budgetType }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('budget_categories')
    .insert({ user_id: user.id, type, name, budget_type: budgetType || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addSubcategory(categoryId, name) {
  const { data, error } = await supabase
    .from('budget_subcategories')
    .insert({ category_id: categoryId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameCategory(id, name) {
  const { error } = await supabase
    .from('budget_categories')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function setCategoryBudgetType(id, budgetType) {
  const { error } = await supabase
    .from('budget_categories')
    .update({ budget_type: budgetType })
    .eq('id', id);
  if (error) throw error;
}

export async function renameSubcategory(id, name) {
  const { error } = await supabase
    .from('budget_subcategories')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function archiveCategory(id) {
  const { error } = await supabase
    .from('budget_categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function archiveSubcategory(id) {
  const { error } = await supabase
    .from('budget_subcategories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================================
// PRÉVISIONNEL RÉCURRENT
// ============================================================================
// Résout, pour chaque sous-catégorie, le montant prévu applicable au mois demandé :
// priorité à une ligne ponctuelle exacte pour ce mois, sinon la ligne "récurrente"
// (applies_forward = true) la plus récente dont effective_from <= month.
export async function getForecastForMonth(month) {
  const { data, error } = await supabase
    .from('forecast_values')
    .select('*')
    .lte('effective_from', month)
    .order('effective_from', { ascending: false });
  if (error) throw error;

  const bySub = new Map();
  for (const row of data) {
    if (bySub.has(row.subcategory_id)) continue; // déjà résolu par une ligne plus récente
    if (row.effective_from === month || row.applies_forward) {
      bySub.set(row.subcategory_id, Number(row.amount));
    }
  }
  return bySub;
}

export async function setForecastValue(
  subcategoryId,
  month,
  amount,
  applyToFuture
) {
  const { error } = await supabase.from('forecast_values').insert({
    subcategory_id: subcategoryId,
    amount,
    effective_from: month,
    applies_forward: applyToFuture,
  });
  if (error) throw error;
}

// ============================================================================
// SAISIES HORODATÉES (le "réel")
// ============================================================================
export async function getEntriesForMonth(month) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('month', month)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addEntry({
  subcategoryId,
  amount,
  entryDate,
  comment,
  receiptUrl,
  receiptExtracted,
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: user.id,
      subcategory_id: subcategoryId,
      amount,
      entry_date: entryDate,
      comment: comment || null,
      receipt_url: receiptUrl || null,
      receipt_extracted: receiptExtracted || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

// Total réel (somme des saisies) par sous-catégorie, pour un mois donné.
export async function getMonthlyActuals(month) {
  const { data, error } = await supabase
    .from('monthly_actuals')
    .select('*')
    .eq('month', month);
  if (error) throw error;
  const map = new Map();
  data.forEach((r) => map.set(r.subcategory_id, Number(r.reel)));
  return map;
}

// Prévisionnel + réel résolus pour les 12 mois d'une année (utilisé par la vue annuelle du tableau de bord).
export async function getYearData(year) {
  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`
  );
  const [forecastsByMonth, actualsByMonth] = await Promise.all([
    Promise.all(months.map((m) => getForecastForMonth(m))),
    Promise.all(months.map((m) => getMonthlyActuals(m))),
  ]);
  return { months, forecastsByMonth, actualsByMonth };
}

// Total réel par sous-catégorie, cumulé sur les 12 mois d'une année.
export async function getYearlyActuals(year) {
  const { data, error } = await supabase
    .from('entries')
    .select('subcategory_id, amount, month')
    .gte('month', `${year}-01`)
    .lte('month', `${year}-12`);
  if (error) throw error;
  const map = new Map();
  data.forEach((r) =>
    map.set(
      r.subcategory_id,
      (map.get(r.subcategory_id) || 0) + Number(r.amount)
    )
  );
  return map;
}

// Total prévu par sous-catégorie, cumulé sur les 12 mois d'une année (résout le
// prévisionnel récurrent mois par mois, comme getForecastForMonth, puis additionne).
export async function getYearlyForecast(year) {
  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`
  );
  const perMonth = await Promise.all(months.map((m) => getForecastForMonth(m)));
  const map = new Map();
  perMonth.forEach((monthMap) => {
    for (const [subId, amt] of monthMap.entries()) {
      map.set(subId, (map.get(subId) || 0) + amt);
    }
  });
  return map;
}

// ============================================================================
// REPORT DE SOLDE ENTRE MOIS
// ============================================================================
export async function getCarryoverDecision(month) {
  const { data, error } = await supabase
    .from('month_decisions')
    .select('*')
    .eq('month', month)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCarryoverForMonth(month) {
  const { data, error } = await supabase
    .from('month_carryover')
    .select('*')
    .eq('to_month', month)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function decideCarryover(fromMonth, toMonth, amount, carry) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (carry) {
    const { error } = await supabase.from('month_carryover').upsert(
      {
        user_id: user.id,
        from_month: fromMonth,
        to_month: toMonth,
        amount,
      },
      { onConflict: 'user_id,to_month' }
    );
    if (error) throw error;
  }
  const { error: decisionError } = await supabase
    .from('month_decisions')
    .upsert(
      {
        user_id: user.id,
        month: fromMonth,
        status: carry ? 'carried' : 'ignored',
      },
      { onConflict: 'user_id,month' }
    );
  if (decisionError) throw decisionError;
}

// ============================================================================
// REÇUS (photo + extraction automatique)
// ============================================================================
export async function uploadReceipt(file) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('receipts').upload(path, file);
  if (error) throw error;
  return path;
}

export async function getReceiptSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// Appelle l'Edge Function qui envoie l'image à Claude et renvoie {montant, date, marchand}
export async function extractReceipt(path) {
  const { data, error } = await supabase.functions.invoke('extract-receipt', {
    body: { path },
  });
  if (error) throw error;
  return data;
}
