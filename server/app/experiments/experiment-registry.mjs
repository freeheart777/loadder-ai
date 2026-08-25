export function createExperimentRegistry() {
  const experiments = new Map();

  return {
    register(experiment) {
      experiments.set(experiment.id, experiment);
      return experiment;
    },

    get(id) {
      return experiments.get(id) || null;
    },

    list() {
      return Array.from(experiments.values());
    },
  };
}
