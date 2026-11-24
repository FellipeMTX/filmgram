begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(id,email) values
 ('81000000-0000-0000-0000-000000000001','popcorn-rating-one@example.test'),
 ('81000000-0000-0000-0000-000000000002','popcorn-rating-two@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
select lives_ok($$insert into public.reviews(user_id,media_type,tmdb_id,rating) values ('81000000-0000-0000-0000-000000000001','movie',987654321,0)$$,'title accepts zero');
select lives_ok($$select public.save_person_review(987654321,0,null,'[]'::jsonb)$$,'person RPC accepts zero');
select throws_ok($$update public.reviews set rating=-1 where user_id='81000000-0000-0000-0000-000000000001'$$,'23514',null,'title rejects negative ratings');
select throws_ok($$select public.save_person_review(987654322,-1,null,'[]'::jsonb)$$,'22023',null,'person RPC rejects negative ratings');

select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000002',true);
select lives_ok($$insert into public.reviews(user_id,media_type,tmdb_id,rating) values ('81000000-0000-0000-0000-000000000002','movie',987654321,10)$$,'title accepts ten');
select lives_ok($$select public.save_person_review(987654321,10,null,'[]'::jsonb)$$,'person RPC accepts ten');
select throws_ok($$update public.reviews set rating=11 where user_id='81000000-0000-0000-0000-000000000002'$$,'23514',null,'title rejects ratings above ten');
select throws_ok($$update public.person_reviews set rating=11 where user_id='81000000-0000-0000-0000-000000000002'$$,'23514',null,'person table rejects ratings above ten');
select is((select average_rating from public.person_rating_stats(987654321)),5::numeric,'average includes ratings of both zero and ten');

select * from finish();
rollback;
