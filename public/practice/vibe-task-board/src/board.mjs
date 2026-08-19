export function addTask(tasks, title) {
  if (!title?.trim()) throw new Error('title-required')
  return [...tasks, { id: `task-${tasks.length + 1}`, title: title.trim(), status: 'open' }]
}

export function completeTask(tasks, id) {
  return tasks.map((task) => task.id === id ? { ...task, status: 'done' } : task)
}
