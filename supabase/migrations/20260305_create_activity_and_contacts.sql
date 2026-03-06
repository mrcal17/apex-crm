-- Activity Log table
create table if not exists activity_log (
  id uuid default gen_random_uuid() primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details text,
  created_at timestamptz default now()
);

alter table activity_log enable row level security;
create policy "Allow all access to activity_log" on activity_log for all using (true) with check (true);

-- Auto-log project changes
create or replace function log_project_activity()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into activity_log (entity_type, entity_id, action, details)
    values ('project', NEW.id, 'created', 'Created project "' || NEW.name || '"');
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.status != NEW.status then
      insert into activity_log (entity_type, entity_id, action, details)
      values ('project', NEW.id, 'status_changed', '"' || NEW.name || '" changed from ' || OLD.status || ' to ' || NEW.status);
    else
      insert into activity_log (entity_type, entity_id, action, details)
      values ('project', NEW.id, 'updated', 'Updated project "' || NEW.name || '"');
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into activity_log (entity_type, entity_id, action, details)
    values ('project', OLD.id, 'deleted', 'Deleted project "' || OLD.name || '"');
    return OLD;
  end if;
end;
$$ language plpgsql;

drop trigger if exists project_activity_trigger on projects;
create trigger project_activity_trigger
  after insert or update or delete on projects
  for each row execute function log_project_activity();

-- Auto-log commission changes
create or replace function log_commission_activity()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into activity_log (entity_type, entity_id, action, details)
    values ('commission', NEW.id, 'created', 'Commission of $' || NEW.amount || ' created');
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.status != NEW.status then
      insert into activity_log (entity_type, entity_id, action, details)
      values ('commission', NEW.id, 'status_changed', 'Commission status changed to ' || NEW.status);
    end if;
    return NEW;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

drop trigger if exists commission_activity_trigger on commissions;
create trigger commission_activity_trigger
  after insert or update on commissions
  for each row execute function log_commission_activity();

-- Auto-log permit changes
create or replace function log_permit_activity()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into activity_log (entity_type, entity_id, action, details)
    values ('permit', NEW.id, 'created', 'Permit "' || coalesce(NEW.permit_number, NEW.agency, 'Unknown') || '" created');
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.status != NEW.status then
      insert into activity_log (entity_type, entity_id, action, details)
      values ('permit', NEW.id, 'status_changed', 'Permit "' || coalesce(NEW.permit_number, NEW.agency, 'Unknown') || '" changed to ' || NEW.status);
    end if;
    return NEW;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

drop trigger if exists permit_activity_trigger on permits;
create trigger permit_activity_trigger
  after insert or update on permits
  for each row execute function log_permit_activity();

-- Client Contacts table
create table if not exists client_contacts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text,
  phone text,
  company text,
  role text,
  notes text,
  created_at timestamptz default now()
);

alter table client_contacts enable row level security;
create policy "Allow all access to client_contacts" on client_contacts for all using (true) with check (true);
