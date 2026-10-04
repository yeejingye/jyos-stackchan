// A second definition proving that display-only flows reuse the same lifecycle.
export function timerFlow({ show, hide }) {
  return {
    readyMs: 5000,
    readyText: 'Your timer has finished',
    show: (text, phase) => show(text || 'Timer running', phase, phase === 'ready' ? 'Timer finished' : 'Timer'),
    hide,
    complete: async () => {},
  }
}
