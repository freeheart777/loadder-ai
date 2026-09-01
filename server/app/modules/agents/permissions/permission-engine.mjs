export class PermissionEngine {
  canExecute(agent, permission) {
    const permissions = agent?.permissions || [];

    return permissions.includes("*") || permissions.includes(permission);
  }
}
