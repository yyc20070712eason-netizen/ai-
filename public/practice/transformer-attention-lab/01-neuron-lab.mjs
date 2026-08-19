export const relu = (value) => Math.max(0, value)
export const neuron = (inputs, weights, bias) => relu(inputs.reduce((sum, value, index) => sum + value * weights[index], bias))
