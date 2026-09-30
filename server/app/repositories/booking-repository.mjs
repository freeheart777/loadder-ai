import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
const map = (row) => row && ({ ...row, active: row.active === 1 });
export function createBookingRepository(db) {
  const ws = () => requireWorkspaceId(); const now = () => new Date().toISOString();
  const list = (table) => db.prepare(`SELECT * FROM ${table} WHERE workspace_id=? ORDER BY created_at DESC`).all(ws()).map(map);
  const insert = (table, data) => { const id = crypto.randomUUID(), at = now(); const fields = Object.keys(data); db.prepare(`INSERT INTO ${table}(id,workspace_id,${fields.join(",")},created_at,updated_at) VALUES(?,?,${fields.map(()=>"?").join(",")},?,?)`).run(id,ws(),...fields.map(k=>data[k]),at,at); return db.prepare(`SELECT * FROM ${table} WHERE id=? AND workspace_id=?`).get(id,ws()); };
  const owns = (table,id) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND workspace_id=?`).get(id,ws()));
  return Object.freeze({
    listServices:()=>list("booking_services"), listProviders:()=>list("booking_providers"), listAppointments:()=>list("booking_appointments"),
    createService: ({name,durationMinutes})=>map(insert("booking_services",{name,duration_minutes:durationMinutes,active:1})),
    createProvider: ({name})=>map(insert("booking_providers",{name,active:1})),
    associate(providerId,serviceId) { if(!owns("booking_providers",providerId)||!owns("booking_services",serviceId)) return false; db.prepare("INSERT OR IGNORE INTO booking_provider_services(workspace_id,provider_id,service_id,created_at) VALUES(?,?,?,?)").run(ws(),providerId,serviceId,now()); return true; },
    addAvailability({providerId,weekday,startsAt,endsAt}) { if(!owns("booking_providers",providerId)) return null; const id=crypto.randomUUID(); db.prepare("INSERT INTO booking_availability(id,workspace_id,provider_id,weekday,starts_at,ends_at,created_at) VALUES(?,?,?,?,?,?,?)").run(id,ws(),providerId,weekday,startsAt,endsAt,now()); return db.prepare("SELECT * FROM booking_availability WHERE id=? AND workspace_id=?").get(id,ws()); },
    listAvailability:()=>list("booking_availability"),
    createAppointment({serviceId,providerId,customerName,startsAt}) { if(!owns("booking_services",serviceId)||!owns("booking_providers",providerId)) return null; return map(insert("booking_appointments",{service_id:serviceId,provider_id:providerId,customer_name:customerName,starts_at:startsAt,status:"PENDING"})); },
  });
}
