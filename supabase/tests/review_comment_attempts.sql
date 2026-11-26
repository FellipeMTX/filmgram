begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('74100000-0000-0000-0000-000000000001', 'comment-attempt-one@example.test'),
  ('74100000-0000-0000-0000-000000000002', 'comment-attempt-two@example.test');
insert into public.reviews (id, user_id, media_type, tmdb_id, rating) values
  ('74200000-0000-0000-0000-000000000001', '74100000-0000-0000-0000-000000000001', 'tv', 740000001, 5),
  ('74200000-0000-0000-0000-000000000002', '74100000-0000-0000-0000-000000000002', 'movie', 740000001, 4);
insert into public.review_comments (id, review_id, user_id, body) values
  ('74300000-0000-0000-0000-000000000001', '74200000-0000-0000-0000-000000000001', '74100000-0000-0000-0000-000000000002', 'Legacy target'),
  ('74300000-0000-0000-0000-000000000002', '74200000-0000-0000-0000-000000000001', '74100000-0000-0000-0000-000000000002', 'Another target by the same author');

set local role authenticated;
select set_config('request.jwt.claim.sub', '74100000-0000-0000-0000-000000000001', true);
select set_config(
  'filmgram_test.comment_id',
  public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', '74300000-0000-0000-0000-000000000001',
    '  First submission  ', '74400000-0000-0000-0000-000000000001'
  )::text,
  true
);

select is(
  (select mentioned_profile_id from public.review_comments
   where id = current_setting('filmgram_test.comment_id')::uuid and parent_id is null),
  '74100000-0000-0000-0000-000000000002'::uuid,
  'an attempt creates a flat comment mentioning the existing target author'
);

select is(
  public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', '74300000-0000-0000-0000-000000000001',
    'First submission', '74400000-0000-0000-0000-000000000001'
  ),
  current_setting('filmgram_test.comment_id')::uuid,
  'a repeated submission returns the original comment ID'
);

select is(
  (select count(*) from public.review_comments where body = 'First submission'),
  1::bigint,
  'a repeated submission creates only one comment'
);

select throws_ok(
  $$select public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000002', '74300000-0000-0000-0000-000000000001',
    'First submission', '74400000-0000-0000-0000-000000000001'
  )$$, '22023', null, 'an attempt cannot be replayed for a different review'
);

select throws_ok(
  $$select public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', '74300000-0000-0000-0000-000000000002',
    'First submission', '74400000-0000-0000-0000-000000000001'
  )$$, '22023', null, 'an attempt distinguishes different target comments from the same author'
);

select throws_ok(
  $$select public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', null,
    'First submission', '74400000-0000-0000-0000-000000000001'
  )$$, '22023', null, 'an attempt distinguishes a mention from a new top-level comment'
);

select throws_ok(
  $$select public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000002', '74300000-0000-0000-0000-000000000001',
    'New attempt', '74400000-0000-0000-0000-000000000002'
  )$$, '22023', null, 'a new attempt still rejects a mention to another review'
);

select lives_ok(
  $$select public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', '74300000-0000-0000-0000-000000000001',
    'New attempt', '74400000-0000-0000-0000-000000000002'
  )$$, 'a rejected write leaves its attempt available for the correct destination'
);

select public.create_review_comment_with_mention(
  '74200000-0000-0000-0000-000000000001', null, 'Legacy client'
);
select public.create_review_comment_with_mention(
  '74200000-0000-0000-0000-000000000001', null, 'Legacy client'
);
select is(
  (select count(*) from public.review_comments where body = 'Legacy client'),
  2::bigint, 'legacy calls without an attempt retain their previous behavior'
);

select public.update_review_comment(current_setting('filmgram_test.comment_id')::uuid, 'Edited comment');
select is(
  public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', '74300000-0000-0000-0000-000000000001',
    'First submission', '74400000-0000-0000-0000-000000000001'
  ),
  current_setting('filmgram_test.comment_id')::uuid,
  'the original attempt still resolves after a comment edit'
);
select is(
  (select body from public.review_comments where id = current_setting('filmgram_test.comment_id')::uuid),
  'Edited comment', 'replaying the original attempt preserves the latest body'
);

select set_config('request.jwt.claim.sub', '74100000-0000-0000-0000-000000000002', true);
select isnt(
  public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000002', null,
    'Other author', '74400000-0000-0000-0000-000000000001'
  ),
  current_setting('filmgram_test.comment_id')::uuid,
  'another author can use the same attempt ID independently'
);

select public.delete_review_comment('74300000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub', '74100000-0000-0000-0000-000000000001', true);
select is(
  public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', '74300000-0000-0000-0000-000000000001',
    'First submission', '74400000-0000-0000-0000-000000000001'
  ),
  current_setting('filmgram_test.comment_id')::uuid,
  'a replay still works after the original mention target is soft-deleted'
);

select throws_ok(
  $$select public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', '74300000-0000-0000-0000-000000000001',
    'New reply', '74400000-0000-0000-0000-000000000003'
  )$$, '22023', null, 'a new attempt cannot mention a soft-deleted target'
);

select public.delete_review_comment(current_setting('filmgram_test.comment_id')::uuid);
select is(
  public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', '74300000-0000-0000-0000-000000000001',
    'First submission', '74400000-0000-0000-0000-000000000001'
  ),
  current_setting('filmgram_test.comment_id')::uuid,
  'replaying a soft-deleted comment returns the same ID'
);
select ok(
  (select deleted_at is not null and body is null
   from public.review_comments where id = current_setting('filmgram_test.comment_id')::uuid),
  'replay preserves the deletion and erased body'
);

select throws_ok(
  $$select * from private.review_comment_attempts$$,
  '42501', null, 'attempt metadata is private even for authenticated authors'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.create_review_comment_with_mention(
    '74200000-0000-0000-0000-000000000001', null,
    'Anonymous comment', '74400000-0000-0000-0000-000000000003'
  )$$, '42501', null, 'guests cannot create comments with an attempt ID'
);

select * from finish();
rollback;
