import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('tenant foundation enforces database permissions', async (t) => {
  const db = new PGlite();
  const owner = '10000000-0000-0000-0000-000000000001';
  const staff = '10000000-0000-0000-0000-000000000002';
  const platform = '10000000-0000-0000-0000-000000000003';
  const a = '20000000-0000-0000-0000-000000000001';
  const b = '20000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      create function storage.foldername(text) returns text[] language sql immutable as
      $$ select string_to_array($1,'/') $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      grant usage on schema storage to authenticated;
      grant select,insert,update on storage.objects to authenticated;
    `);
    for (const migration of [
      '202609090001_tenant_foundation.sql',
      '202609090003_session_api.sql',
      '202609090004_record_types.sql'
    ]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await db.query('insert into auth.users(id) values ($1),($2),($3)', [owner,staff,platform]);
    await db.query("insert into public.salon_shops(id,code,name,country) values ($1,'SHOP_A','A','AE'),($2,'SHOP_B','B','QA')", [a,b]);
    await db.query("insert into public.salon_memberships(shop_id,user_id,role) values ($1,$2,'owner'),($1,$3,'staff')", [a,owner,staff]);
    await db.query('insert into public.salon_platform_admins(user_id) values ($1)',[platform]);
    await db.query("insert into public.salon_documents(shop_id,title,category,subject_user_id) values ($1,'Lease','lease',null),($1,'Staff health','health',$3),($2,'Other shop','lease',null)", [a,b,staff]);
    await db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'service','s1','{}',$2),($1,'expense','e1','{}',$2),($3,'service','s2','{}',$2)",[a,owner,b]);
    async function asUser(id) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
      await db.exec('set role authenticated');
    }
    await t.test('owner sees only their shop and its documents', async () => {
      await asUser(owner);
      assert.equal((await db.query('select * from public.salon_shops')).rows.length,1);
      assert.equal((await db.query('select * from public.salon_documents')).rows.length,2);
      assert.equal((await db.query('select * from public.salon_records')).rows.length,2);
      assert.deepEqual((await db.query('select shop_code,role from public.salon_session()')).rows, [{shop_code:'SHOP_A',role:'owner'}]);
    });
    await t.test('owner cannot insert documents into another shop', async () => {
      await assert.rejects(db.query("insert into public.salon_documents(shop_id,title,category) values ($1,'Intrusion','lease')",[b]), /row-level security/);
    });
    await t.test('owner cannot promote themselves or forge audit events', async () => {
      await assert.rejects(db.query('insert into public.salon_platform_admins(user_id) values ($1)',[owner]), /permission denied/);
      await assert.rejects(db.query("update public.salon_memberships set role='owner'"), /permission denied/);
      await assert.rejects(db.query("insert into public.salon_audit_events(action,entity_id) values ('fake','fake')"), /permission denied/);
    });
    await t.test('staff sees only their own documents, cannot edit them', async () => {
      await asUser(staff);
      assert.deepEqual((await db.query('select title from public.salon_documents')).rows, [{title:'Staff health'}]);
      assert.deepEqual((await db.query('select record_type from public.salon_records')).rows, [{record_type:'service'}]);
      assert.equal((await db.query("update public.salon_documents set title='tampered' returning id")).rows.length,0);
      await assert.rejects(db.query("insert into public.salon_documents(shop_id,title,category) values ($1,'New','health')",[a]), /row-level security/);
    });
    await t.test('platform admin can view all shops', async () => {
      await asUser(platform);
      assert.equal((await db.query('select * from public.salon_shops')).rows.length,2);
      assert.equal((await db.query('select * from public.salon_documents')).rows.length,3);
      assert.equal((await db.query('select * from public.salon_records')).rows.length,3);
      assert.deepEqual((await db.query('select shop_code,role from public.salon_session()')).rows, [{shop_code:'PLATFORM',role:'platform_admin'}]);
    });
    await t.test('suspension revokes existing sessions at query time', async () => {
      await db.exec('reset role');
      await db.query("update public.salon_shops set status='suspended' where id=$1",[a]);
      await asUser(owner);
      assert.equal((await db.query('select * from public.salon_shops')).rows.length,0);
      assert.equal((await db.query('select * from public.salon_documents')).rows.length,0);
    });
    await t.test('anonymous requests cannot read shop records', async () => {
      await db.exec('reset role; set role anon');
      await assert.rejects(db.query('select * from public.salon_shops'), /permission denied/);
    });
  } finally {
    await db.close();
  }
});
