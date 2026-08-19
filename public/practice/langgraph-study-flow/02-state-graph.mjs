import { Annotation, END, START, StateGraph } from '@langchain/langgraph'

const State = Annotation.Root({ topic: Annotation(), status: Annotation() })
export const stateGraph = new StateGraph(State)
  .addNode('normalize', ({ topic }) => ({ topic: String(topic ?? '').trim() }))
  .addNode('route', ({ topic }) => ({ status: topic ? 'ready' : 'missing' }))
  .addEdge(START, 'normalize').addEdge('normalize', 'route').addEdge('route', END).compile()
