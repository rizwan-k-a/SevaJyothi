
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 50;

CREATE OR REPLACE FUNCTION public.tg_complaints_priority_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.priority_score IS NULL OR NEW.priority_score = 50 THEN
    NEW.priority_score := CASE NEW.category::text
      WHEN 'transformer'   THEN 100
      WHEN 'network_tower' THEN 100
      WHEN 'water_pipe'    THEN 80
      WHEN 'sewage_leak'   THEN 80
      WHEN 'road_damage'   THEN 50
      WHEN 'street_light'  THEN 30
      ELSE 50
    END;
  END IF;
  IF NEW.priority IS NULL OR NEW.priority = 'normal' THEN
    NEW.priority := CASE
      WHEN NEW.priority_score >= 100 THEN 'critical'::priority_level
      WHEN NEW.priority_score >= 80  THEN 'high'::priority_level
      WHEN NEW.priority_score >= 50  THEN 'normal'::priority_level
      ELSE 'low'::priority_level
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complaints_priority_score ON public.complaints;
CREATE TRIGGER complaints_priority_score
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaints_priority_score();

UPDATE public.complaints SET priority_score = CASE category::text
  WHEN 'transformer'   THEN 100
  WHEN 'network_tower' THEN 100
  WHEN 'water_pipe'    THEN 80
  WHEN 'sewage_leak'   THEN 80
  WHEN 'road_damage'   THEN 50
  WHEN 'street_light'  THEN 30
  ELSE 50
END;
