create or replace function public.create_review_comment(
 p_review_id uuid, p_parent_id uuid, p_body text
) returns uuid language plpgsql security invoker set search_path = '' as $$
begin
 if p_parent_id is not null then
  raise exception 'Nested comments are read-only' using errcode = '22023';
 end if;
 return public.create_review_comment_with_mention(p_review_id,null,p_body);
end $$;
