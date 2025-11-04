import { supabase } from "./supabaseClient.js";

// Fetch all users
export async function getUsers() {
  const { data, error } = await supabase.from("users").select("*");
  if (error) throw error;
  return data;
}

// Add a new user
export async function addUser(user) {
  const { data, error } = await supabase.from("users").insert([user]);
  if (error) throw error;
  return data;
}
