import { supabase } from "./supabaseClient.js";


export async function signUp(email, password, name = "", phone = "") {
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) throw authError;
  const { data: dbData, error: dbError } = await supabase
    .from("users")
    .insert([
      {
        supabase_id: authData.user.id,
        email: authData.user.email,
        name,
        phone,
      },
    ]);

  if (dbError) throw dbError;

  return { authData, dbData };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return { success: true };
}
