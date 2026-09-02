export const ContentAgent = {
  name: "content-agent",
  permissions: ["content.generate"],
  async run(input = {}) {
    return { title: input.title || "", status: "generated" };
  }
};
