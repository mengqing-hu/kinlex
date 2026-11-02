interface HideMeaningsToggleProps {
  checked: boolean
  hideLabel: string
  showLabel: string
  onChange: (checked: boolean) => void
}

export function HideMeaningsToggle({
  checked,
  hideLabel,
  showLabel,
  onChange,
}: HideMeaningsToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-[var(--ink)]">
      <input
        checked={checked}
        className="size-4 accent-[var(--suffix)]"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{checked ? showLabel : hideLabel}</span>
    </label>
  )
}
