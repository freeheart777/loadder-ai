export function createSkillRegistry(initialSkills = []) {
  const skills = new Map();
  for (const skill of initialSkills) register(skill);
  function register(skill) {
    if (!skill?.id || !skill?.name) throw new TypeError("skill id and name are required");
    const normalized = Object.freeze({ id: skill.id, name: skill.name, description: skill.description ?? "", tags: Object.freeze([...(skill.tags ?? [])]), dependsOn: Object.freeze([...(skill.dependsOn ?? [])]) });
    skills.set(normalized.id, normalized);
    return normalized;
  }
  return Object.freeze({ register, get: (id) => skills.get(id), list: () => [...skills.values()], resolve: (ids) => ids.flatMap((id) => { const skill = skills.get(id); return skill ? [skill, ...skill.dependsOn.flatMap((dep) => { const s = skills.get(dep); return s ? [s] : []; })] : []; }) });
}
