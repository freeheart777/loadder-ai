import test from "node:test";
import assert from "node:assert/strict";
import { LoadderAIGateway } from "../app/business-builder/ai-gateway.mjs";
import { createSandboxSpec, LoadderRuntimeController } from "../app/business-builder/runtime-contracts.mjs";

test("AI gateway fails over without leaking provider dependency into callers", async () => {
  const gateway = new LoadderAIGateway({
    providers: {
      primary: { generate: async () => { throw new Error("down"); } },
      secondary: { generate: async () => ({ text: "ok", model: "secondary-model" }) },
    },
  });
  const result = await gateway.generate({ task: "business_analysis", input: "build a CRM" });
  assert.equal(result.text, "ok");
  assert.equal(result.providerId, "secondary");
  assert.equal(result.attempts.length, 2);
});

test("private AI execution never routes to cloud providers", async () => {
  let cloudCalled = false;
  const gateway = new LoadderAIGateway({ providers: {
    primary: { generate: async () => { cloudCalled = true; return { text: "cloud" }; } },
    local: { generate: async () => ({ text: "private" }) },
  }});
  const result = await gateway.generate({ privacy: "private", input: "secret business data" });
  assert.equal(result.providerId, "local");
  assert.equal(cloudCalled, false);
});

test("sandbox contract rejects host-level privileges", () => {
  assert.throws(() => createSandboxSpec({ appId: "crm", buildId: "b1", capabilities: ["host_docker_socket"] }), /Forbidden sandbox capabilities/);
  const spec = createSandboxSpec({ appId: "crm", buildId: "b2" });
  assert.equal(spec.isolation.ephemeral, true);
  assert.equal(spec.isolation.noNewPrivileges, true);
  assert.equal(spec.isolation.readOnlyRootFilesystem, true);
});

test("runtime destroys failed workspaces", async () => {
  let destroyed = false;
  const adapter = {
    createWorkspace: async () => ({ id: "w1" }),
    writeFiles: async () => {},
    installDependencies: async () => {},
    runBuild: async () => { throw new Error("compile failed"); },
    startPreview: async () => ({}),
    destroyWorkspace: async () => { destroyed = true; },
  };
  const runtime = new LoadderRuntimeController({ adapter });
  await assert.rejects(() => runtime.build({ definition: { id: "crm" }, files: [], spec: createSandboxSpec({ appId: "crm", buildId: "b3" }) }));
  assert.equal(destroyed, true);
});
