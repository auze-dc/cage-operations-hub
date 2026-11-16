SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.acknowledge_chat_messages(
  message_keys text[], mark_read boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  org uuid;
  pending_ids text[];
  visible_ids text[];
  affected integer;
BEGIN
  IF actor IS NULL OR public.module_level('chat') = 'none' THEN
    RAISE EXCEPTION 'Chat access required';
  END IF;
  IF cardinality(message_keys) > 500 THEN
    RAISE EXCEPTION 'Too many messages in one acknowledgement';
  END IF;
  org := public.current_organization_id();

  -- Most delivery requests repeat IDs already acknowledged on a previous refresh.
  SELECT array_agg(p.message_id) INTO pending_ids
  FROM (
    SELECT r.message_id
    FROM public.chat_receipts r
    WHERE r.organization_id = org AND r.recipient_id = actor
      AND r.message_id = ANY(message_keys)
      AND (r.delivered_at IS NULL OR (mark_read AND r.read_at IS NULL))
    UNION
    SELECT k.message_id
    FROM unnest(message_keys) AS k(message_id)
    JOIN public.personal_notifications n
      ON n.event_key IN ('mention:' || k.message_id || ':' || actor,
                         'chat:' || k.message_id || ':' || actor)
    WHERE mark_read AND n.user_id = actor AND n.target_view = 'chat' AND n.read_at IS NULL
  ) p;
  IF pending_ids IS NULL THEN
    RETURN 0;
  END IF;

  SELECT array_agg(m->>'id') INTO visible_ids
  FROM public.workspace_states w
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.data->'messages','[]')) m
  WHERE w.organization_id = org AND m->>'id' = ANY(pending_ids)
    AND public.record_visible('messages', m, w.data, actor);

  UPDATE public.chat_receipts r
  SET delivered_at = coalesce(r.delivered_at, now()),
      read_at = CASE WHEN mark_read THEN coalesce(r.read_at, now()) ELSE r.read_at END
  WHERE r.organization_id = org AND r.recipient_id = actor AND r.message_id = ANY(visible_ids)
    AND (r.delivered_at IS NULL OR (mark_read AND r.read_at IS NULL));
  GET DIAGNOSTICS affected = ROW_COUNT;

  IF mark_read THEN
    UPDATE public.personal_notifications n SET read_at = now()
    WHERE n.user_id = actor AND n.target_view = 'chat' AND n.read_at IS NULL
      AND EXISTS (
        SELECT 1 FROM unnest(visible_ids) AS k(message_id)
        WHERE n.event_key IN ('mention:' || k.message_id || ':' || actor,
                              'chat:' || k.message_id || ':' || actor)
      );
  END IF;
  RETURN affected;
END;
$$;
