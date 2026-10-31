CREATE OR REPLACE FUNCTION enforce_draftable_has_citation() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'draftable' AND NOT EXISTS (SELECT 1 FROM citations WHERE draft_id = NEW.id) THEN
    RAISE EXCEPTION 'draftable draft % has no citation', NEW.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER drafts_require_citation
  AFTER INSERT ON drafts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_draftable_has_citation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_export_review_not_rejected() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reviews WHERE id = NEW.review_id AND decision = 'reject') THEN
    RAISE EXCEPTION 'review % is a rejection and cannot be exported', NEW.review_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER exports_require_approved_review
  BEFORE INSERT ON exports
  FOR EACH ROW EXECUTE FUNCTION enforce_export_review_not_rejected();
