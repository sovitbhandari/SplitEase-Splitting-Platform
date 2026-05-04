INSERT INTO users (id, email, password_hash, display_name)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'alice@example.com',
    '$2b$12$qxXPK5su3hNhFp1MghwMwezn8I4D4ew3Efr2E1VlzDqgW8sELpP6u',
    'Alice'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'bob@example.com',
    '$2b$12$he.7wP.7gqgD6fWy6FqYvOTqSBxoq5PgQ9xQF2jRQENxQ4xHjQWmC',
    'Bob'
  )
ON CONFLICT (email) DO NOTHING;

INSERT INTO groups (id, name, description, currency, invite_code, created_by)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Miami Weekend Trip',
  'Seeded group for local testing',
  'USD',
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111'
)
ON CONFLICT (invite_code) DO NOTHING;

INSERT INTO group_members (group_id, user_id, role)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'member')
ON CONFLICT (group_id, user_id) DO NOTHING;
