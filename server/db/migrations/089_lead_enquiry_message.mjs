// Website contact forms capture the visitor's own words. The canonical `leads`
// table had nowhere to put them, so the text was accepted and dropped. This is
// additive: an existing lead simply has no enquiry message.
//
// `leads` is created by database.mjs's bootstrap rather than by a migration, so
// this is a no-op on a schema subset that does not carry it.
export const migration089LeadEnquiryMessage = {
  version: 89,
  name: "lead_enquiry_message",
  up(db) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'").get();
    if (!exists) return;
    const columns = new Set(db.prepare("PRAGMA table_info(leads)").all().map((row) => row.name));
    if (!columns.has("message")) db.exec("ALTER TABLE leads ADD COLUMN message TEXT;");
  },
};
