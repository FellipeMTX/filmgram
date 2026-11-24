alter table public.review_comments add column mentioned_profile_id uuid
  references public.profiles(id) on delete set null;
create index review_comments_mentioned_profile_idx on public.review_comments(mentioned_profile_id)
  where mentioned_profile_id is not null;

create or replace view public.flat_review_comments
with (security_invoker = true) as
select c.id, c.review_id, c.parent_id, c.user_id, c.body, c.created_at,
       c.updated_at, c.deleted_at, author.display_name, author.handle,
       author.avatar_url, coalesce(mentioned.handle, target_author.handle) as reply_to_handle
from public.review_comments c
left join public.profiles author on author.id = c.user_id and c.deleted_at is null
left join public.review_comments target on target.id = c.parent_id
  and target.review_id = c.review_id and target.deleted_at is null
left join public.profiles target_author on target_author.id = target.user_id
left join public.profiles mentioned on mentioned.id = c.mentioned_profile_id;


create function public.create_review_comment_with_mention(
 p_review_id uuid, p_target_comment_id uuid, p_body text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_profile_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then
  raise exception 'Invalid comment' using errcode = '22023';
 end if;
 if p_target_comment_id is not null then
  select user_id into v_profile_id from public.review_comments
  where id = p_target_comment_id and review_id = p_review_id
    and deleted_at is null and user_id is not null for share;
  if not found then raise exception 'Invalid mention target' using errcode = '22023'; end if;
 end if;
 insert into public.review_comments(review_id,user_id,mentioned_profile_id,body)
 values (p_review_id,auth.uid(),v_profile_id,btrim(p_body)) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_review_comment_with_mention(uuid,uuid,text) from public,anon;
grant execute on function public.create_review_comment_with_mention(uuid,uuid,text) to authenticated;
