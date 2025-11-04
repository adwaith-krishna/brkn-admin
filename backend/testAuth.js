const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

console.log("DEBUG ENV CHECK:");
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY exists:", !!process.env.SUPABASE_ANON_KEY);

// Use anon key for signup/login
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function run() {
  const email = "tsgqna@gmail.com";
  const password = "mypassword123";
  const name = "test";      // example name
  const phone = "+919876543210";  // example phone

  // 🔹 1. Sign up
  console.log("Signing up...");
  let { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) {
    console.error("Signup error:", authError.message);
  } else {
    console.log("Signup success:", authData);

    // 🔹 1a. Insert user details into database
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

    if (dbError) {
      console.error("DB insert error:", dbError.message);
    } else {
      console.log("User saved in DB:", dbData);
    }
  }

  // 🔹 2. Log in
  console.log("Logging in...");
  ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  if (error) {
    console.error("Login error:", error.message);
  } else {
    console.log("Login success:", data);
  }

  // 🔹 3. Get current user
  const { data: userData } = await supabase.auth.getUser();
  console.log("Current user:", userData);

  // 🔹 4. Logout
  console.log("Logging out...");
  ({ error } = await supabase.auth.signOut());
  if (error) {
    console.error("Logout error:", error.message);
  } else {
    console.log("Logged out successfully");
  }
}

run();
