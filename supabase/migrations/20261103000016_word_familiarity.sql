-- Self-rated familiarity per word: 0 means unrated, 1-5 are the levels a learner marks in the list.

alter table public.user_word_state
  add column familiarity smallint not null default 0
    check (familiarity between 0 and 5);
