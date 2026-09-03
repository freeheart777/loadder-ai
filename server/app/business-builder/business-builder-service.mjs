import { loadderBusinessCompiler } from "./business-compiler.mjs";
import { renderLoadderApp } from "./app-renderer.mjs";
import { createSandboxSpec } from "./runtime-contracts.mjs";

const nowId = () => `build-${Date.now().toString(36)}`;

export class LoadderBusinessBuilderService {
  constructor({ compiler = loadderBusinessCompiler, renderer = renderLoadderApp, buildIdFactory = nowId } = {}) {
    this.compiler = compiler;
    this.renderer = renderer;
    this.buildIdFactory = buildIdFactory;
  }

  plan(input) {
    const definition = this.compiler.compile(input);
    const ui = this.renderer(definition);
    const buildId = this.buildIdFactory();
    const sandbox = createSandboxSpec({ appId: definition.id, buildId });

    return Object.freeze({
      contract: "loadder.business-build-plan.v1",
      buildId,
      definition,
      ui,
      sandbox,
      gates: [
        { id: "schema-valid", status: "passed" },
        { id: "provider-independent", status: definition.ownership?.providerIndependent ? "passed" : "failed" },
        { id: "sandbox-isolated", status: sandbox.isolation.noNewPrivileges ? "passed" : "failed" },
        { id: "human-approval-before-production", status: "required" },
      ],
      next: {
        action: "materialize-source",
        productionDeploymentAllowed: false,
      },
    });
  }
}

export const loadderBusinessBuilderService = new LoadderBusinessBuilderService();
