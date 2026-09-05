export class LoadderDeploymentError extends Error {
  constructor(message, code = "LOADDER_DEPLOYMENT_BLOCKED") {
    super(message);
    this.name = "LoadderDeploymentError";
    this.code = code;
  }
}

export class LoadderDeploymentAdapter {
  async deployCanary() { throw new Error("deployCanary() not implemented"); }
  async promote() { throw new Error("promote() not implemented"); }
  async rollback() { throw new Error("rollback() not implemented"); }
}

export class LoadderDeploymentController {
  constructor({ adapter, projectService, healthCheck = async () => ({ healthy: true }), audit = () => {} } = {}) {
    if (!adapter) throw new TypeError("deployment adapter is required");
    if (!projectService) throw new TypeError("projectService is required");
    this.adapter = adapter;
    this.projectService = projectService;
    this.healthCheck = healthCheck;
    this.audit = audit;
  }

  async deploy({ projectId, version }) {
    if (!this.projectService.canDeployProduction(projectId)) {
      throw new LoadderDeploymentError("Production approval is required.", "LOADDER_PRODUCTION_APPROVAL_REQUIRED");
    }
    const canary = await this.adapter.deployCanary({ projectId, version, trafficPercent: 5 });
    this.audit({ type: "deployment.canary.started", projectId, versionId: version.id });
    const health = await this.healthCheck({ projectId, version, deployment: canary });
    if (!health?.healthy) {
      await this.adapter.rollback({ projectId, version, deployment: canary, reason: health?.reason || "health-check-failed" });
      this.audit({ type: "deployment.rollback", projectId, versionId: version.id });
      throw new LoadderDeploymentError("Canary health check failed; rolled back.", "LOADDER_CANARY_FAILED");
    }
    const production = await this.adapter.promote({ projectId, version, deployment: canary, trafficPercent: 100 });
    this.audit({ type: "deployment.promoted", projectId, versionId: version.id });
    return { canary, health, production };
  }
}
