create view public.flat_review_comments
with (security_invoker = true) as
select c.id, c.review_id, c.parent_id, c.user_id, c.body, c.created_at,
       c.updated_at, c.deleted_at, author.display_name, author.handle,
       author.avatar_url, target_author.handle as reply_to_handle
from public.review_comments c
left join public.profiles author on author.id = c.user_id and c.deleted_at is null
left join public.review_comments target on target.id = c.parent_id
  and target.review_id = c.review_id and target.deleted_at is null
left join public.profiles target_author on target_author.id = target.user_id;

revoke all on public.flat_review_comments from public, anon, authenticated;
grant select on public.flat_review_comments to anon, authenticated;

create index review_comments_flat_page_idx on public.review_comments(review_id, created_at, id);

create function public.flat_review_comments_page(
 p_review_id uuid, p_after_created_at timestamptz, p_after_id uuid, p_limit integer
) returns setof public.flat_review_comments
language sql stable security invoker set search_path = '' as $$
 select c.* from public.flat_review_comments c
 where c.review_id = p_review_id
 and ((p_after_created_at is null and p_after_id is null)
      or (c.created_at,c.id) > (p_after_created_at,p_after_id))
 order by c.created_at,c.id limit least(greatest(coalesce(p_limit,21),1),101)
$$;
revoke all on function public.flat_review_comments_page(uuid,timestamptz,uuid,integer) from public;
grant execute on function public.flat_review_comments_page(uuid,timestamptz,uuid,integer) to anon, authenticated;
