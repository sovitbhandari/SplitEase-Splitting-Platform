CREATE OR REPLACE FUNCTION prevent_ledger_update_delete()
RETURNS trigger AS $$
DECLARE
  allow_mutation TEXT;
BEGIN
  allow_mutation := current_setting('app.allow_ledger_mutation', true);
  IF allow_mutation = 'on' THEN
    IF TG_OP = 'UPDATE' THEN
      RETURN NEW;
    END IF;
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$ LANGUAGE plpgsql;
