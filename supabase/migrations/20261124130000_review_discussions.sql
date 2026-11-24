create table public.review_likes (
 review_id uuid not null references public.reviews(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key (review_id,user_id)
);
alter table public.review_likes enable row level security;
create policy review_likes_own on public.review_likes for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.review_likes from public, anon, authenticated;
grant select on public.review_likes to authenticated;
create function public.set_review_like(p_review_id uuid, p_liked boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if p_review_id is null or p_liked is null then raise exception 'Invalid like' using errcode = '22023'; end if;
 if p_liked then
  insert into public.review_likes(review_id,user_id) values (p_review_id,auth.uid()) on conflict do nothing;
 else
  delete from public.review_likes where review_id = p_review_id and user_id = auth.uid();
 end if;
end $$;
create table public.review_comments (
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.reviews(id) on delete cascade,
 parent_id uuid references public.review_comments(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null,
 body text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 deleted_at timestamptz,
 constraint review_comment_body check ((deleted_at is null and body is not null and char_length(btrim(body)) between 1 and 2000) or (deleted_at is not null and body is null))
);
create index review_comments_page_idx on public.review_comments(review_id,parent_id,created_at,id);
alter table public.review_comments enable row level security;
create policy review_comments_read on public.review_comments for select to anon, authenticated using (true);
revoke all on public.review_comments from public, anon, authenticated;
grant select on public.review_comments to anon, authenticated;
create function public.create_review_comment(p_review_id uuid, p_parent_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'Invalid comment' using errcode = '22023'; end if;
 if p_parent_id is not null then
  perform 1 from public.review_comments c where c.id = p_parent_id and c.review_id = p_review_id and c.parent_id is null and c.deleted_at is null for share;
  if not found then raise exception 'Invalid parent' using errcode = '22023'; end if;
 end if;
 insert into public.review_comments(review_id,parent_id,user_id,body) values (p_review_id,p_parent_id,auth.uid(),btrim(p_body)) returning id into v_id;
 return v_id;
end $$;
create function public.update_review_comment(p_comment_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'Invalid comment' using errcode = '22023'; end if;
 update public.review_comments set body = btrim(p_body), updated_at = clock_timestamp() where id = p_comment_id and user_id = auth.uid() and deleted_at is null;
 if not found then raise exception 'Comment not found' using errcode = '42501'; end if;
end $$;
create function public.delete_review_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 update public.review_comments set body = null, deleted_at = clock_timestamp(), updated_at = clock_timestamp() where id = p_comment_id and user_id = auth.uid() and deleted_at is null;
 if not found then raise exception 'Comment not found' using errcode = '42501'; end if;
end $$;
revoke all on function public.create_review_comment(uuid,uuid,text), public.update_review_comment(uuid,text), public.delete_review_comment(uuid) from public, anon;
grant execute on function public.create_review_comment(uuid,uuid,text), public.update_review_comment(uuid,text), public.delete_review_comment(uuid) to authenticated;

create function public.review_comments_page(p_review_id uuid, p_parent_id uuid, p_after_created_at timestamptz, p_after_id uuid, p_limit integer)
returns table(id uuid, review_id uuid, parent_id uuid, user_id uuid, body text, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz, display_name text, handle text, avatar_url text)
language sql stable security invoker set search_path = '' as $$
 select c.id,c.review_id,c.parent_id,c.user_id,c.body,c.created_at,c.updated_at,c.deleted_at,p.display_name,p.handle,p.avatar_url
 from public.review_comments c left join public.profiles p on p.id = c.user_id
 where c.review_id = p_review_id and c.parent_id is not distinct from p_parent_id
 and ((p_after_created_at is null and p_after_id is null) or (c.created_at,c.id) > (p_after_created_at,p_after_id))
 order by c.created_at,c.id limit least(greatest(coalesce(p_limit, 21),1),101)
$$;
revoke all on function public.review_comments_page(uuid,uuid,timestamptz,uuid,integer) from public;
grant execute on function public.review_comments_page(uuid,uuid,timestamptz,uuid,integer) to anon, authenticated;

-- Preserve other users' replies when a comment author removes their account.
create function public.tombstone_deleted_profile_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 update public.review_comments set body = null, deleted_at = coalesce(deleted_at, clock_timestamp()), updated_at = clock_timestamp()
 where user_id = old.id;
 return old;
end $$;
create trigger tombstone_deleted_profile_comments before delete on public.profiles
for each row execute function public.tombstone_deleted_profile_comments();
revoke all on function public.tombstone_deleted_profile_comments() from public, anon, authenticated;

create function public.review_like_summaries(p_review_ids uuid[])
returns table(review_id uuid, like_count bigint, liked boolean, comment_count bigint)
language sql stable security definer set search_path = '' as $$
 select r.id, count(l.user_id), coalesce(bool_or(l.user_id = auth.uid()), false), (select count(*) from public.review_comments c where c.review_id = r.id and c.deleted_at is null)
 from public.reviews r left join public.review_likes l on l.review_id = r.id
 where r.id = any(p_review_ids) group by r.id
$$;
revoke all on function public.set_review_like(uuid,boolean) from public, anon;
grant execute on function public.set_review_like(uuid,boolean) to authenticated;
revoke all on function public.review_like_summaries(uuid[]) from public;
grant execute on function public.review_like_summaries(uuid[]) to anon, authenticated;
