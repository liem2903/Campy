import type { ReactNode } from 'react'

// A dark pill with an icon in a circle that nudges right on hover (mouse only).
function IconPillButton({ onClick, disabled = false, icon, children }: { onClick: () => void; disabled?: boolean; icon: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex cursor-pointer items-center gap-3 rounded-full border-0 bg-text py-2 pr-2 pl-6 text-[15px] font-medium text-bg [font-family:inherit] transition-[transform,opacity] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.97] disabled:cursor-default disabled:opacity-35 disabled:active:scale-100"
    >
      {children}
      <span
        aria-hidden="true"
        className="inline-flex size-8 items-center justify-center rounded-full bg-bg/15 transition-transform duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-enabled:group-hover:translate-x-0.5"
      >
        {icon}
      </span>
    </button>
  )
}

export default IconPillButton
