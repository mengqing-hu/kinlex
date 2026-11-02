import type { WordForm } from '@/types/domain'

interface FormsTableProps {
  forms: WordForm[]
  formLabel: string
  typeLabel: string
}

export function FormsTable({ forms, formLabel, typeLabel }: FormsTableProps) {
  if (forms.length === 0) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)]">
      <table className="w-full border-collapse text-left">
        <thead className="bg-[var(--bg)] text-xs text-[var(--mute)]">
          <tr>
            <th className="px-3 py-2 font-medium" scope="col">
              {formLabel}
            </th>
            <th className="px-3 py-2 font-medium" scope="col">
              {typeLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {forms.map((form) => (
            <tr className="border-t border-[var(--line)]" key={`${form.form}-${form.type ?? ''}`}>
              <td className="px-3 py-2 text-sm font-medium text-[var(--ink)]">{form.form}</td>
              <td className="px-3 py-2 text-sm text-[var(--mute)]">
                {form.type
                  ? `${form.type.charAt(0).toUpperCase()}${form.type.slice(1).replaceAll('_', ' ')}`
                  : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
