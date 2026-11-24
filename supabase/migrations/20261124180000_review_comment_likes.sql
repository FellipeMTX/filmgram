create table public.review_comment_likes (
  comment_id uuid not null references public.review_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index review_comment_likes_user_idx on public.review_comment_likes(user_id);
alter table public.review_comment_likes enable row level security;
revoke all on public.review_comment_likes from public, anon, authenticated;

create function public.review_comment_like_summaries(p_comment_ids uuid[])
returns table(comment_id uuid, like_count bigint, liked boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, count(l.user_id), coalesce(bool_or(l.user_id = auth.uid()), false)
  from public.review_comments c
  left join public.review_comment_likes l on l.comment_id = c.id
  where c.id = any(p_comment_ids) and c.deleted_at is null
  group by c.id
$$;

create function public.set_review_comment_like(p_comment_id uuid, p_liked boolean)
returns table(comment_id uuid, like_count bigint, liked boolean)
language plpgsql security definer set search_path = '' as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_liked is null then raise exception 'Invalid like' using errcode = '22023'; end if;
  perform 1 from public.review_comments c
    where c.id = p_comment_id and c.deleted_at is null for share;
  if not found then raise exception 'Comment not found' using errcode = '22023'; end if;

  if p_liked then
    insert into public.review_comment_likes(comment_id,user_id)
      values (p_comment_id,viewer) on conflict on constraint review_comment_likes_pkey do nothing;
  else
    delete from public.review_comment_likes l where l.comment_id = p_comment_id and l.user_id = viewer;
  end if;
  return query select * from public.review_comment_like_summaries(array[p_comment_id]);
end $$;

revoke all on function public.review_comment_like_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.review_comment_like_summaries(uuid[]) to anon, authenticated;
revoke all on function public.set_review_comment_like(uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_review_comment_like(uuid,boolean) to authenticated;
