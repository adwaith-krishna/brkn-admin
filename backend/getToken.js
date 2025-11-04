// Use require syntax for CommonJS
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function run() {
  // ❗ IMPORTANT: Make sure this user exists in your Supabase Auth panel
  const email = "tsgqna@gmail.com";
  const password = "mypassword123";

  console.log("Attempting to log in as user:", email);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Login failed:", error.message);
  } else {
    console.log("\n✅ Login Successful!");
    console.log("\n--- YOUR JWT TOKEN ---");
    // This is the token you need
    console.log(data.session.access_token);
    console.log("--- COPY THE TOKEN ABOVE ---\n");
  }
}

run();