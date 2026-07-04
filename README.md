# ADIS — Anti-Doping Intelligence System (Demo)

A demo web app modeling the Athlete Biological Passport (ABP) concept:
officers register athletes, log samples with biological markers, and the
system flags unusual changes automatically.

## Pages

| File | Purpose |
|---|---|
| `signin.html` | Officer account creation |
| `login.html` | Officer login |
| `dashboard.html` | Summary stats + recent activity |
| `athletes.html` | Register and list athletes |
| `samples.html` | Collect samples (type, date, location, Hb, HCT, Ret%) |
| `reports.html` | Generate reports; view report shows the passport trend chart |

## Setup

1. Create a free project at supabase.com.
2. In `supabase.js`, replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your project's values (Project Settings → API).
3. In the Supabase SQL editor, create the tables:

```sql
create table officers (
  id uuid primary key references auth.users(id),
  officer_id text,
  username text,
  phone text
);

create table athletes (
  id uuid primary key default gen_random_uuid(),
  athlete_id text,
  athlete_name text,
  gender text,
  date_of_birth date,
  nationality text,
  sport text,
  email text,
  phone text,
  blood_group text,
  weight numeric,
  height numeric,
  registered_by uuid references auth.users(id),
  created_at timestamp default now()
);

create table samples (
  id uuid primary key default gen_random_uuid(),
  sample_id text,
  athlete_id uuid references athletes(id),
  officer_id uuid references auth.users(id),
  sample_type text,
  collection_date date,
  collection_location text,
  hemoglobin numeric,
  hematocrit numeric,
  reticulocyte_percentage numeric,
  sample_status text,
  remarks text,
  created_at timestamp default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  report_id text,
  athlete_id uuid references athletes(id),
  sample_id uuid references samples(id),
  generated_by uuid references auth.users(id),
  report_status text,
  generated_at timestamp default now()
);
```

4. On officer sign-up, insert a matching row into `officers` (trigger, or do it manually via a Supabase Function) so `officer_id`/`username` show correctly in the sidebar. Example trigger:

```sql
create function public.handle_new_officer()
returns trigger as $$
begin
  insert into public.officers (id, officer_id, username, phone)
  values (new.id, new.raw_user_meta_data->>'officer_id',
          new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'phone');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_officer();
```

5. Enable Row Level Security on each table and add policies so officers can only see rows they created (e.g. `registered_by = auth.uid()`).
6. Open `signin.html` in a browser (or serve the folder with any static server) to create the first account.

## How the anomaly detection works

Each sample can store hemoglobin, hematocrit, and reticulocyte percentage.
When a report is generated, the app:

1. Pulls all of that athlete's past samples.
2. Computes a simplified OFF-score: `Hb(g/L) − 60 × √Ret%`.
3. Flags a sample if a marker falls outside a broad reference range, or
   changes sharply from the previous sample.
4. Plots hemoglobin, hematocrit, and reticulocyte% over time (Chart.js),
   marking flagged points in red.

This is an educational simplification, not the real WADA/ABP methodology.
