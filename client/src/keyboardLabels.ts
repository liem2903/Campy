// Shortcut labels in the keys each computer has. Macs have ⌘ for Ctrl and Option for Alt;
// "Add question" uses Control + Option there, since ⌘ + Option + M minimizes all windows.
export const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
export const commandKey = isMac ? '⌘' : 'Ctrl'
export const addQuestionKeys = isMac ? 'Control + Option + M' : 'Ctrl + Alt + M'
