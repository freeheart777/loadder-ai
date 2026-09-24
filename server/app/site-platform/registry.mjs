// ADR-004 capability + section registry. Metadata only: no renderers, not
// wired into the runtime yet (Phase 1).

export class RegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}

const fail = (code, message) => { throw new RegistryError(code, message); };

/** active = selectable and loadable; internal = dependency only, never selected directly; pending = recognized, not loadable yet. */
export const CAPABILITY_STATUSES = Object.freeze(["active", "internal", "pending"]);

const KEY = /^[a-z][a-zA-Z0-9]*$/;
const SECTION_TYPE = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;

const stringList = (value, what) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) fail("INVALID_DEFINITION", `${what} must be a list of non-empty strings`);
  return value.map((item) => item.trim());
};

export function defineSection({ type, capability, label, aliases, variants, fields, interactive = false, seo = null } = {}) {
  if (typeof type !== "string" || !SECTION_TYPE.test(type)) fail("INVALID_SECTION_TYPE", `section type "${type}" must be namespaced as <capability>.<name>`);
  if (typeof capability !== "string" || !KEY.test(capability)) fail("INVALID_SECTION_CAPABILITY", `section ${type} needs a capability key`);
  if (type.split(".")[0] !== capability) fail("SECTION_NAMESPACE_MISMATCH", `section ${type} must be namespaced by its capability "${capability}"`);
  if (typeof label !== "string" || !label.trim()) fail("INVALID_DEFINITION", `section ${type} needs a label`);
  const aliasList = stringList(aliases, `${type} aliases`);
  if (aliasList.some((alias) => alias.includes("."))) fail("INVALID_ALIAS", `section ${type} aliases are legacy plain types, never namespaced`);
  const variantList = stringList(variants ?? ["default"], `${type} variants`);
  if (!variantList.length) fail("INVALID_DEFINITION", `section ${type} needs at least one variant`);
  return Object.freeze({
    type,
    capability,
    label: label.trim(),
    aliases: Object.freeze(aliasList),
    variants: Object.freeze(variantList),
    fields: Object.freeze(stringList(fields, `${type} fields`)),
    interactive: Boolean(interactive),
    seo: seo && typeof seo === "object" ? Object.freeze({ ...seo }) : null,
  });
}

export function defineCapability({ key, label, dependencies, sections = [], interactive = false, status = "active" } = {}) {
  if (typeof key !== "string" || !KEY.test(key)) fail("INVALID_CAPABILITY_KEY", `capability key "${key}" is invalid`);
  if (typeof label !== "string" || !label.trim()) fail("INVALID_DEFINITION", `capability ${key} needs a label`);
  if (!CAPABILITY_STATUSES.includes(status)) fail("INVALID_DEFINITION", `capability ${key} status must be one of ${CAPABILITY_STATUSES.join(", ")}`);
  if (!Array.isArray(sections)) fail("INVALID_DEFINITION", `capability ${key} sections must be a list`);
  const dependencyList = stringList(dependencies, `${key} dependencies`);
  if (dependencyList.includes(key)) fail("CIRCULAR_DEPENDENCY", `capability ${key} depends on itself`);
  const sectionList = sections.map((section) => (Object.isFrozen(section) && section.type ? section : defineSection({ capability: key, ...section })));
  for (const section of sectionList) if (section.capability !== key) fail("SECTION_NAMESPACE_MISMATCH", `section ${section.type} belongs to ${section.capability}, not ${key}`);
  return Object.freeze({
    key,
    label: label.trim(),
    dependencies: Object.freeze(dependencyList),
    sections: Object.freeze(sectionList),
    interactive: Boolean(interactive || sectionList.some((section) => section.interactive)),
    status,
  });
}

export function createRegistry(capabilityList = []) {
  const capabilities = new Map();
  const sections = new Map();
  const aliases = new Map();

  for (const capability of capabilityList) {
    if (!capability || !Object.isFrozen(capability) || !CAPABILITY_STATUSES.includes(capability.status)) fail("INVALID_DEFINITION", "registry accepts only defineCapability() results");
    if (capabilities.has(capability.key)) fail("DUPLICATE_CAPABILITY", `capability ${capability.key} is registered twice`);
    capabilities.set(capability.key, capability);
  }
  for (const capability of capabilities.values()) {
    for (const dependency of capability.dependencies) if (!capabilities.has(dependency)) fail("MISSING_CAPABILITY", `capability ${capability.key} depends on unregistered ${dependency}`);
    for (const section of capability.sections) {
      if (sections.has(section.type) || aliases.has(section.type)) fail("DUPLICATE_SECTION", `section ${section.type} is registered twice`);
      sections.set(section.type, section);
      for (const alias of section.aliases) {
        if (aliases.has(alias)) fail("DUPLICATE_SECTION", `alias ${alias} maps to both ${aliases.get(alias)} and ${section.type}`);
        aliases.set(alias, section.type);
      }
    }
  }

  // Reject dependency cycles once, at construction (depth-first, three colors).
  const state = new Map();
  const visit = (key, trail) => {
    if (state.get(key) === "done") return;
    if (state.get(key) === "visiting") fail("CIRCULAR_DEPENDENCY", `capability dependency cycle: ${[...trail, key].join(" -> ")}`);
    state.set(key, "visiting");
    for (const dependency of capabilities.get(key).dependencies) visit(dependency, [...trail, key]);
    state.set(key, "done");
  };
  for (const key of capabilities.keys()) visit(key, []);

  /** Requested keys plus their transitive dependencies; unregistered keys are dropped. */
  function expand(keys = []) {
    const result = new Set();
    const add = (key) => {
      if (result.has(key) || !capabilities.has(key)) return;
      result.add(key);
      for (const dependency of capabilities.get(key).dependencies) add(dependency);
    };
    for (const key of keys) add(key);
    return [...capabilities.keys()].filter((key) => result.has(key));
  }

  const resolveSectionType = (type) => (typeof type !== "string" ? null : sections.has(type) ? type : aliases.get(type) || null);

  return Object.freeze({
    expand,
    /** Section definitions available to the given capabilities (dependencies included; pending capabilities contribute nothing). */
    sectionsFor: (keys) => expand(keys)
      .map((key) => capabilities.get(key))
      .filter((capability) => capability.status !== "pending")
      .flatMap((capability) => capability.sections),
    resolveSectionType,
    capabilityOf: (type) => sections.get(resolveSectionType(type))?.capability || null,
    getSection: (type) => sections.get(resolveSectionType(type)) || null,
    getCapability: (key) => capabilities.get(key) || null,
    /** Capabilities a user may enable directly; internal and pending ones are excluded. */
    selectableCapabilities: () => [...capabilities.values()].filter((capability) => capability.status === "active").map((capability) => capability.key),
    capabilities: () => [...capabilities.values()],
  });
}
