import crypto from "node:crypto";

import { requireWorkspaceId } from "../tenant-context.mjs";

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name,
    website: row.website,
    industry: row.industry,
    subindustry: row.subindustry,
    description: row.description,
    country: row.country,
    city: row.city,
    phone: row.phone,
    email: row.email,
    timezone: row.timezone,
    primaryLanguage: row.primary_language,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const columns = {
  name: "name",
  legalName: "legal_name",
  website: "website",
  industry: "industry",
  subindustry: "subindustry",
  description: "description",
  country: "country",
  city: "city",
  phone: "phone",
  email: "email",
  timezone: "timezone",
  primaryLanguage: "primary_language",
  status: "status",
};

export function createBusinessProfileRepository(db) {
  function getBusinessProfile() {
    return mapProfile(
      db
        .prepare("SELECT * FROM business_profiles WHERE workspace_id = ?")
        .get(requireWorkspaceId())
    );
  }

  function createBusinessProfile(values, timestamp) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO business_profiles (
        id, workspace_id, name, legal_name, website, industry,
        subindustry, description, country, city, phone, email,
        timezone, primary_language, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      requireWorkspaceId(),
      values.name,
      values.legalName,
      values.website,
      values.industry,
      values.subindustry,
      values.description,
      values.country,
      values.city,
      values.phone,
      values.email,
      values.timezone,
      values.primaryLanguage,
      values.status,
      timestamp,
      timestamp
    );
    return getBusinessProfile();
  }

  function updateBusinessProfile(values, timestamp) {
    const entries = Object.entries(values).filter(([key]) => columns[key]);
    if (entries.length === 0) return getBusinessProfile();
    const assignments = entries.map(([key]) => `${columns[key]} = ?`);
    const result = db.prepare(`
      UPDATE business_profiles
      SET ${assignments.join(", ")}, updated_at = ?
      WHERE workspace_id = ?
    `).run(
      ...entries.map(([, value]) => value),
      timestamp,
      requireWorkspaceId()
    );
    return result.changes ? getBusinessProfile() : null;
  }

  return {
    getBusinessProfile,
    createBusinessProfile,
    updateBusinessProfile,
  };
}
