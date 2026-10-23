-- Lets an admin delete a person (auth user). Their own rows cascade; announcements they wrote stay, with no author.
alter table public.announcements drop constraint if exists announcements_author_fkey;
alter table public.announcements add constraint announcements_author_fkey
  foreign key (author) references public.profiles(id) on delete set null;
