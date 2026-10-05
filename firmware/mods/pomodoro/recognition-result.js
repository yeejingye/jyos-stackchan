const COMMANDS = ['', 'pomodoro', 'pause', 'resume', 'cancel']

// Keep native IDs and wake authorization at one independently testable boundary.
export function dispatchRecognition(window, id) {
  const command = Number.isInteger(id) ? COMMANDS[id] : undefined
  return { command, accepted: !!command && window.command(command) }
}
