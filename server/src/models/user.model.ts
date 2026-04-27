import { query } from '../utils/db';

export type PublicUser = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT id, email, password_hash, display_name, avatar_url, created_at, updated_at
     FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT id, email, password_hash, display_name, avatar_url, created_at, updated_at
     FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  password_hash: string;
  display_name: string;
}): Promise<PublicUser> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES (lower($1), $2, $3)
     RETURNING id, email, password_hash, display_name, avatar_url, created_at, updated_at`,
    [input.email, input.password_hash, input.display_name]
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Failed to create user');
  }
  return toPublicUser(row);
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
  };
}
