-- The spellings a word part takes in the words that use it, most used first, as the site shows
-- it: in- (im-, i-). The pipeline keeps it up to date. The first carries the homograph number
-- (in2-) only when another word part of the same type is spelled like it. Empty where the
-- pipeline has not filled it, and the site then shows the morpheme itself.

alter table public.morphemes add column spellings text[];
