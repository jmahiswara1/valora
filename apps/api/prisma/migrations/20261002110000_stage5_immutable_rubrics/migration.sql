-- A publication is a historical scoring snapshot. Edits belong in RubricDraft.
CREATE FUNCTION protect_published_rubric() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published rubric versions are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER rubric_version_immutable BEFORE UPDATE OR DELETE ON "RubricVersion"
FOR EACH ROW EXECUTE FUNCTION protect_published_rubric();
