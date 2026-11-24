-- Return the stale-order conflict directly through PostgREST without a serialization retry.
create or replace function public.reorder_playlist_items(p_playlist_id uuid, p_item_ids uuid[], p_expected_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare current_ids uuid[];
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.playlists where id = p_playlist_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  select coalesce(array_agg(id order by position, id), '{}'::uuid[]) into current_ids from public.playlist_items where playlist_id = p_playlist_id;
  if p_expected_ids is distinct from current_ids then raise exception 'Playlist order changed; refresh and try again' using errcode = 'PT409'; end if;
  if p_item_ids is null or cardinality(p_item_ids) <> cardinality(current_ids)
     or (select count(distinct id) from unnest(p_item_ids) as ids(id)) <> cardinality(current_ids)
     or exists (select 1 from unnest(p_item_ids) as ids(id) where id is null or not (id = any(current_ids))) then
    raise exception 'Item IDs must contain every playlist item exactly once' using errcode = '22023';
  end if;
  set constraints public.playlist_items_position_unique deferred;
  update public.playlist_items i set position = (ordered.ordinality - 1)::integer
  from unnest(p_item_ids) with ordinality as ordered(id, ordinality) where i.id = ordered.id and i.playlist_id = p_playlist_id;
end $$;
