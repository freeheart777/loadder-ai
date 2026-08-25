const actions = new Map();

export function registerAction(action) {
  if (!action?.id) throw new Error('Action id is required');
  actions.set(action.id, action);
  return action;
}

export function getAction(id) {
  return actions.get(id) || null;
}

export function getAllActions() {
  return Array.from(actions.values());
}
