export function createPatternMatcher(memory) {
  return {
    match(context) {
      return memory.findSimilar(context);
    },
  };
}
