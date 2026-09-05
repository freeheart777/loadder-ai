const FORBIDDEN_CAPABILITIES = new Set(["host_docker_socket", "host_network", "privileged", "host_filesystem"]);

export function createSandboxSpec({ appId, buildId, image = "loadder/runtime-node", cpu = 1, memoryMb = 1024, timeoutSeconds = 300, network = "egress-filtered", capabilities = [] }) {
  if (!appId || !buildId) throw new TypeError("appId and buildId are required.");
  const forbidden = capabilities.filter((item) => FORBIDDEN_CAPABILITIES.has(item));
  if (forbidden.length) throw new Error(`Forbidden sandbox capabilities: ${forbidden.join(", ")}`);
  return Object.freeze({
    contract: "loadder.sandbox.v1",
    appId,
    buildId,
    image,
    resources: { cpu, memoryMb, timeoutSeconds },
    isolation: {
      ephemeral: true,
      readOnlyRootFilesystem: true,
      noNewPrivileges: true,
      network,
      capabilities,
    },
  });
}

export class LoadderRuntimeAdapter {
  async createWorkspace() { throw new Error("createWorkspace() not implemented"); }
  async writeFiles() { throw new Error("writeFiles() not implemented"); }
  async installDependencies() { throw new Error("installDependencies() not implemented"); }
  async runBuild() { throw new Error("runBuild() not implemented"); }
  async startPreview() { throw new Error("startPreview() not implemented"); }
  async destroyWorkspace() { throw new Error("destroyWorkspace() not implemented"); }
}

export class LoadderRuntimeController {
  constructor({ adapter, audit = () => {} }) {
    if (!adapter) throw new TypeError("runtime adapter is required");
    this.adapter = adapter;
    this.audit = audit;
  }

  async build({ definition, files, spec }) {
    const workspace = await this.adapter.createWorkspace({ definition, spec });
    this.audit({ type: "workspace.created", appId: definition.id, buildId: spec.buildId });
    try {
      await this.adapter.writeFiles({ workspace, files });
      await this.adapter.installDependencies({ workspace });
      const build = await this.adapter.runBuild({ workspace });
      const preview = await this.adapter.startPreview({ workspace });
      this.audit({ type: "build.completed", appId: definition.id, buildId: spec.buildId });
      return { workspace, build, preview };
    } catch (error) {
      this.audit({ type: "build.failed", appId: definition.id, buildId: spec.buildId, error: error?.message });
      await this.adapter.destroyWorkspace({ workspace }).catch(() => {});
      throw error;
    }
  }
}

export { FORBIDDEN_CAPABILITIES };
