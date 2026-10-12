// WHAT THIS FILE DOES
// Reusable button used by the menus. Style it with a CSS class.

export function createButton(label: string, onClick: () => void, className = '') {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.addEventListener('click', () => {
    onClick()
    button.blur() // so Space/Enter don't press it again
  })
  return button
}
