import { Annotation, END, START, StateGraph } from '@langchain/langgraph'

const State = Annotation.Root({ message: Annotation() })
export const smokeGraph = new StateGraph(State).addNode('hello', () => ({ message: 'hello' })).addEdge(START, 'hello').addEdge('hello', END).compile()
