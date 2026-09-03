import { loadderBusinessCompiler } from "./business-compiler.mjs";
import { renderLoadderApp } from "./app-renderer.mjs";
import { materializeLoadderSourceBundle } from "./source-materializer.mjs";
import { createSandboxSpec } from "./runtime-contracts.mjs";

const nowId = () => `build-${Date.now().toString(36)}`;

export class LoadderBusinessBuilderService {
  constructor({ compiler = loadderBusinessCompiler, renderer = renderLoadderApp, materializer = materializeLoadderSourceBundle, buildIdFactory = nowId } = {}) {
    this.compiler = compiler;
    this.renderer = renderer;
    this.materializer = materializer;
    this.buildIdFactory = buildIdFactory;
  }

  plan(input) {
    const definition = this.compiler.compile(input);
    const ui = this.renderer(definition);
    const sourceBundle = this.materializer({ definition, ui });
    const buildId = this.buildIdFactory();
    const sandbox = createSandboxSpec({ appId: definition.id, buildId });

    return Object.freeze({
      contract: "loadder.business-build-plan.v1",
      buildId,
      definition,
      ui,
      sourceBundle,
      sandbox,
      gates: [
        { id: "schema-valid", status: "passed" },
        { id: "provider-independent", status: definition.ownership?.providerIndependent ? "passed" : "failed" },
        { id: "portable-source-bundle", status: sourceBundle.portable ? "passed" : "failed" },
        { id: "sandbox-isolated", status: sandbox.isolation.noNewPrivileges ? "passed" : "failed" },
        { id: "human-approval-before-production", status: "required" },
      ],
      next: {
        action: "preview",
        productionDeploymentAllowed: false,
      },
    });
  }

  preview(input) {
    const plan = this.plan(input);
    return Object.freeze({
      contract: "loadder.business-preview.v1",
      buildId: plan.buildId,
      definition: plan.definition,
      ui: plan.ui,
      sourceBundle: plan.sourceBundle,
      gates: plan.gates,
      productionDeploymentAllowed: false,
    });
  }
}

export const loadderBusinessBuilderService = new LoadderBusinessBuilderService();
