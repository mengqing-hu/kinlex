-- Existing databases need their level constraints replaced; editing the original create-table
-- migrations only affects fresh databases.

alter table public.words drop constraint words_level_check;
alter table public.words
  add constraint words_level_check check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.examples drop constraint examples_level_check;
alter table public.examples
  add constraint examples_level_check check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.user_languages drop constraint user_languages_level_check;
alter table public.user_languages
  add constraint user_languages_level_check
  check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
