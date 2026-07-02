-- Create User Profiles table linked to Supabase Auth Users
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text not null unique,
    full_name text,
    role text default 'analyst' check (role in ('analyst', 'risk_officer', 'admin')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Batch Jobs table for async portfolio uploads
create table public.batch_jobs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    filename text not null,
    status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    total_rows integer default 0,
    processed_rows integer default 0,
    error_message text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    completed_at timestamp with time zone
);

-- Customers Portfolio table (Ingested credit card holder details)
create table public.customers (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    batch_job_id uuid references public.batch_jobs(id) on delete cascade,
    customer_id text not null,
    customer_name text not null,
    age integer not null,
    city text not null,
    card_tier text not null check (card_tier in ('Signature', 'Platinum', 'Gold', 'Classic')),
    card_network text not null check (card_network in ('Visa', 'Mastercard', 'RuPay', 'RuPay_UPI')),
    cibil_score integer not null check (cibil_score >= 300 and cibil_score <= 900),
    total_credit_limit double precision not null,
    current_utilization_pct double precision not null,
    payment_status_m1 text not null check (payment_status_m1 in ('Full', 'MAD', 'Late', 'Missed')),
    payment_status_m2 text not null check (payment_status_m2 in ('Full', 'MAD', 'Late', 'Missed')),
    payment_status_m3 text not null check (payment_status_m3 in ('Full', 'MAD', 'Late', 'Missed')),
    payment_status_m4 text not null check (payment_status_m4 in ('Full', 'MAD', 'Late', 'Missed')),
    payment_status_m5 text not null check (payment_status_m5 in ('Full', 'MAD', 'Late', 'Missed')),
    payment_status_m6 text not null check (payment_status_m6 in ('Full', 'MAD', 'Late', 'Missed')),
    avg_monthly_spend double precision not null,
    debt_to_income_pct double precision not null,
    default_6month_label integer check (default_6month_label in (0, 1)), -- binary flag for ML training source
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Predictions table to store continuous risk scores and explanations
create table public.predictions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    customer_id text not null,
    batch_job_id uuid references public.batch_jobs(id) on delete cascade,
    risk_score decimal(5,4) not null check (risk_score >= 0.0000 and risk_score <= 1.0000), -- PD score 0-1
    verdict text not null check (verdict in ('Low Risk', 'Medium Risk', 'High Risk')),
    shap_drivers jsonb not null, -- Top drivers driving the risk score
    risk_narrative text, -- AI risk summary narrative
    collection_strategy text, -- GenAI strategic next steps
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Audit Logs for commercial/compliance security
create table public.audit_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    action text not null,
    details jsonb,
    ip_address text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) Configuration
alter table public.profiles enable row level security;
alter table public.batch_jobs enable row level security;
alter table public.customers enable row level security;
alter table public.predictions enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles Policies
create policy "Users can read own profile" on public.profiles
    for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
    for update using (auth.uid() = id);

-- Batch Jobs Policies
create policy "Users can view own batch jobs" on public.batch_jobs
    for select using (auth.uid() = user_id);
create policy "Users can insert own batch jobs" on public.batch_jobs
    for insert with check (auth.uid() = user_id);
create policy "Users can update own batch jobs" on public.batch_jobs
    for update using (auth.uid() = user_id);

-- Customers Policies
create policy "Users can view own customer records" on public.customers
    for select using (auth.uid() = user_id);
create policy "Users can insert own customer records" on public.customers
    for insert with check (auth.uid() = user_id);

-- Predictions Policies
create policy "Users can view own predictions" on public.predictions
    for select using (auth.uid() = user_id);
create policy "Users can insert own predictions" on public.predictions
    for insert with check (auth.uid() = user_id);

-- Audit Logs Policies
create policy "Users can view own audit logs" on public.audit_logs
    for select using (auth.uid() = user_id);
create policy "System can write audit logs" on public.audit_logs
    for insert with check (true);

-- Real-time & triggers (Automatically create a profile when a new user signs up)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'analyst'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
