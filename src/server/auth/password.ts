import bcrypt from "bcryptjs";

// Supabase hashed every password with bcrypt ($2a$/$2b$, cost 10) directly on
// auth.users.encrypted_password. bcryptjs reads and writes the same format,
// so the 631 existing hashes we migrated keep working — nobody has to reset
// their password. New hashes are written as $2b$ (bcryptjs's default); both
// prefixes verify identically.
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(data: { hash: string; password: string }): Promise<boolean> {
  return bcrypt.compare(data.password, data.hash);
}
