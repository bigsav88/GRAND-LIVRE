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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

// ============================================================================
// PRÉFÉRENCES (salaire, cibles 50/30/20, statut d'onboarding)
// ============================================================================
export async function getPreferences() {
  const { data, error } = await supabase.from('user_preferences').select('*').single();
  if (error) throw error;
  return data;
}

export async function updatePreferences(patch) {
  const { data: { user } } = await supabase.auth.getUser();
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
  return data.map(c => ({
    ...c,
    budget_subcategories: (c.budget_subcategories || [])
      .filter(s => !s.archived_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));
}

export async function addCategory({ type, name, budgetType }) {
  const { data: { user } } = await supabase.auth.getUser();
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
  const { error } = await supabase.from('budget_categories').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function setCategoryBudgetType(id, budgetType) {
  const { error } = await supabase.from('budget_categories').update({ budget_type: budgetType }).eq('id', id);
  if (error) throw error;
}

export async function renameSubcategory(id, name) {
  const { error } = await supabase.from('budget_subcategories').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function archiveCategory(id) {
  const { error } = await supabase.from('budget_categories').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function archiveSubcategory(id) {
  const { error } = await supabase.from('budget_subcategories').update({ archived_at: new Date().toISOString() }).eq('id', id);
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

export async function setForecastValue(subcategoryId, month, amount, applyToFuture) {
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
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addEntry({ subcategoryId, amount, entryDate, comment, receiptUrl, receiptExtracted }) {
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data, error } = await supabase.from('monthly_actuals').select('*').eq('month', month);
  if (error) throw error;
  const map = new Map();
  data.forEach(r => map.set(r.subcategory_id, Number(r.reel)));
  return map;
}

// Prévisionnel + réel résolus pour les 12 mois d'une année (utilisé par la vue annuelle du tableau de bord).
export async function getYearData(year) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const [forecastsByMonth, actualsByMonth] = await Promise.all([
    Promise.all(months.map(m => getForecastForMonth(m))),
    Promise.all(months.map(m => getMonthlyActuals(m))),
  ]);
  return { months, forecastsByMonth, actualsByMonth };
}

// Supprime toutes les données propres à un mois donné : les saisies réelles (entries),
// les décisions/records de report liés à ce mois, et les changements de prévisionnel
// déclenchés CE mois-ci (effective_from = month). Les mois passés et futurs ne sont pas
// touchés, à l'exception d'un report éventuel dont le point de départ était ce mois.
export async function deleteMonthData(month) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error: entriesError } = await supabase.from('entries').delete().eq('user_id', user.id).eq('month', month);
  if (entriesError) throw entriesError;

  const { error: carryFromError } = await supabase.from('month_carryover').delete().eq('user_id', user.id).eq('from_month', month);
  if (carryFromError) throw carryFromError;

  const { error: carryToError } = await supabase.from('month_carryover').delete().eq('user_id', user.id).eq('to_month', month);
  if (carryToError) throw carryToError;

  const { error: decisionError } = await supabase.from('month_decisions').delete().eq('user_id', user.id).eq('month', month);
  if (decisionError) throw decisionError;

  // Ne supprime que les lignes de prévisionnel créées précisément pour ce mois (effective_from = month).
  // Cible via les sous-catégories de l'utilisateur, car forecast_values n'a pas de user_id direct.
  const cats = await getCategories();
  const subIds = cats.flatMap(c => c.budget_subcategories.map(s => s.id));
  if (subIds.length) {
    const { error: forecastError } = await supabase
      .from('forecast_values')
      .delete()
      .eq('effective_from', month)
      .in('subcategory_id', subIds);
    if (forecastError) throw forecastError;
  }
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
  data.forEach(r => map.set(r.subcategory_id, (map.get(r.subcategory_id) || 0) + Number(r.amount)));
  return map;
}

// Total prévu par sous-catégorie, cumulé sur les 12 mois d'une année (résout le
// prévisionnel récurrent mois par mois, comme getForecastForMonth, puis additionne).
export async function getYearlyForecast(year) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const perMonth = await Promise.all(months.map(m => getForecastForMonth(m)));
  const map = new Map();
  perMonth.forEach(monthMap => {
    for (const [subId, amt] of monthMap.entries()) {
      map.set(subId, (map.get(subId) || 0) + amt);
    }
  });
  return map;
}

// ============================================================================
// RATTACHEMENT AU MOIS PRÉCÉDENT (interrupteur toujours modifiable, jamais figé)
// ============================================================================
// Calcule le solde réel (recettes − dépenses) d'UN mois précis à partir de ses
// propres saisies — sert de base au rattachement, sans jamais créer de saisie.
export async function getMonthNetActual(month, categories) {
  const cats = categories || (await getCategories());
  const actuals = await getMonthlyActuals(month);
  const sum = (type) => cats
    .filter(c => c.type === type)
    .reduce((s, c) => s + c.budget_subcategories.reduce((ss, sub) => ss + (actuals.get(sub.id) || 0), 0), 0);
  return sum('recette') - sum('depense');
}

export async function getMonthLinkSetting(month) {
  const { data, error } = await supabase.from('month_settings').select('*').eq('month', month).maybeSingle();
  if (error) throw error;
  return !!(data && data.link_previous);
}

export async function setMonthLinkSetting(month, linked) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('month_settings').upsert({
    user_id: user.id, month, link_previous: linked, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,month' });
  if (error) throw error;
}

// ============================================================================
// SUPPRESSION DE DONNÉES PAR MOIS (avec corbeille de 30 jours)
// ============================================================================
// Marque les saisies d'un ou plusieurs mois comme supprimées (récupérables 30 jours).
// Ne touche jamais au prévisionnel récurrent, seulement au réel (entries).
// Résilient mois par mois : un mois déjà en cours de suppression n'interrompt pas les autres.
export async function requestMonthDeletion(months) {
  const { data: { user } } = await supabase.auth.getUser();
  const batchId = crypto.randomUUID();
  const succeeded = [];
  const skipped = [];
  for (const month of months) {
    const { error: insertError } = await supabase.from('month_deletions').insert({
      user_id: user.id, batch_id: batchId, month,
    });
    if (insertError) {
      // Conflit probable : ce mois a déjà une suppression en cours (index unique).
      skipped.push(month);
      continue;
    }
    const { error: updateError } = await supabase
      .from('entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('month', month)
      .is('deleted_at', null);
    if (updateError) throw updateError;
    succeeded.push(month);
  }
  return { succeeded, skipped };
}

export async function getPendingDeletions() {
  const { data, error } = await supabase
    .from('month_deletions')
    .select('*')
    .eq('status', 'pending')
    .order('purge_at');
  if (error) throw error;
  return data;
}

// Restaure un mois tant que sa purge définitive n'a pas encore eu lieu.
export async function restoreMonthDeletion(deletionId, month) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error: restoreError } = await supabase
    .from('entries')
    .update({ deleted_at: null })
    .eq('user_id', user.id)
    .eq('month', month)
    .not('deleted_at', 'is', null);
  if (restoreError) throw restoreError;

  const { error: statusError } = await supabase
    .from('month_deletions')
    .update({ status: 'restored' })
    .eq('id', deletionId);
  if (statusError) throw statusError;
}


export async function uploadReceipt(file) {
  const { data: { user } } = await supabase.auth.getUser();
  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('receipts').upload(path, file);
  if (error) throw error;
  return path;
}

export async function getReceiptSignedUrl(path) {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// Appelle l'Edge Function qui envoie l'image à Claude et renvoie {montant, date, marchand}
export async function extractReceipt(path) {
  const { data, error } = await supabase.functions.invoke('extract-receipt', { body: { path } });
  if (error) throw error;
  return data;
}
