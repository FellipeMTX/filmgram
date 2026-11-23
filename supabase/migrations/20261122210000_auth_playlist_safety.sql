-- New profiles receive an opaque handle independent of email or auth user ID.
create or replace function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare candidate text; display_label text;
begin
  display_label := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
  if display_label is null or position('@' in display_label) > 0 then display_label := 'Filmgram user'; end if;
  loop
    candidate := 'user_' || replace(gen_random_uuid()::text, '-', '');
    begin
      insert into public.profiles(id, handle, display_name)
      values(new.id, left(candidate, 30), left(display_label, 80));
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return new;
end $$;

-- All mutations pass through functions that lock the same parent row.
revoke insert, update, delete on public.playlist_items from anon, authenticated;
drop function public.reorder_playlist_items(uuid,uuid[]);
create function public.append_playlist_item(p_playlist_id uuid, p_media_type text, p_tmdb_id bigint, p_media_title text, p_poster_path text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.playlists where id = p_playlist_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.playlist_items(playlist_id, media_type, tmdb_id, media_title, poster_path, position)
  select p_playlist_id, p_media_type, p_tmdb_id, p_media_title, p_poster_path, coalesce(max(position) + 1, 0)
  from public.playlist_items where playlist_id = p_playlist_id
  on conflict (playlist_id, media_type, tmdb_id) do nothing;
end $$;
create function public.remove_playlist_item(p_playlist_id uuid, p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.playlists where id = p_playlist_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.playlist_items where playlist_id = p_playlist_id and id = p_item_id;
  set constraints public.playlist_items_position_unique deferred;
  with ordered as (select id, row_number() over (order by position, id) - 1 as new_position from public.playlist_items where playlist_id = p_playlist_id)
  update public.playlist_items i set position = ordered.new_position::integer from ordered where i.id = ordered.id;
end $$;
create function public.reorder_playlist_items(p_playlist_id uuid, p_item_ids uuid[], p_expected_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare current_ids uuid[];
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.playlists where id = p_playlist_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  select coalesce(array_agg(id order by position, id), '{}'::uuid[]) into current_ids from public.playlist_items where playlist_id = p_playlist_id;
  if p_expected_ids is distinct from current_ids then raise exception 'Playlist order changed; refresh and try again' using errcode = '40001'; end if;
  if p_item_ids is null or cardinality(p_item_ids) <> cardinality(current_ids)
     or (select count(distinct id) from unnest(p_item_ids) as ids(id)) <> cardinality(current_ids)
     or exists (select 1 from unnest(p_item_ids) as ids(id) where id is null or not (id = any(current_ids))) then
    raise exception 'Item IDs must contain every playlist item exactly once' using errcode = '22023';
  end if;
  set constraints public.playlist_items_position_unique deferred;
  update public.playlist_items i set position = (ordered.ordinality - 1)::integer
  from unnest(p_item_ids) with ordinality as ordered(id, ordinality) where i.id = ordered.id and i.playlist_id = p_playlist_id;
end $$;
revoke all on function public.append_playlist_item(uuid,text,bigint,text,text), public.remove_playlist_item(uuid,uuid), public.reorder_playlist_items(uuid,uuid[],uuid[]) from public, anon;
grant execute on function public.append_playlist_item(uuid,text,bigint,text,text), public.remove_playlist_item(uuid,uuid), public.reorder_playlist_items(uuid,uuid[],uuid[]) to authenticated;
