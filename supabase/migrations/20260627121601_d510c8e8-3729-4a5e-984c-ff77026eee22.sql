CREATE OR REPLACE FUNCTION public.tg_complaints_priority_score()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
      WHEN NEW.priority_score >= 100 THEN 'critical'::complaint_priority
      WHEN NEW.priority_score >= 80  THEN 'high'::complaint_priority
      WHEN NEW.priority_score >= 50  THEN 'normal'::complaint_priority
      ELSE 'low'::complaint_priority
    END;
  END IF;
  RETURN NEW;
END $$;