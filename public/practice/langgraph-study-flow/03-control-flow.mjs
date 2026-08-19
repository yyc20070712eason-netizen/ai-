export const appendUnique = (current, updates) => [...new Set([...current, ...updates])]
export const routeByBudget = ({ confidence, iteration, maxIterations }) => iteration >= maxIterations ? 'fallback' : confidence < 0.6 ? 'clarify' : 'continue'
