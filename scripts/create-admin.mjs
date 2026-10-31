/**
 * Create (or promote) an admin account.
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/create-admin.mjs admin@example.org 'long-password'
 * Locally, both values come from `supabase status`. Public sign-ups are disabled, so this is
 * the only way to create accounts.
 */
const [email, password] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !password || !url || !key) {
  console.error(
    'Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/create-admin.mjs <email> <password>',
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error('Use a password of at least 12 characters.');
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

let res = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email, password, email_confirm: true }),
});
let user = await res.json();
if (!res.ok) {
  // Already exists: look the user up instead.
  const list = await (await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers })).json();
  user = list.users?.find((u) => u.email === email);
  if (!user) {
    console.error('Could not create user:', JSON.stringify(user ?? list));
    process.exit(1);
  }
}

res = await fetch(`${url}/rest/v1/admin_users`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
  body: JSON.stringify({ user_id: user.id, display_name: email.split('@')[0] }),
});
if (!res.ok) {
  console.error('Could not grant admin:', await res.text());
  process.exit(1);
}
console.log(`Admin ready: ${email}`);
