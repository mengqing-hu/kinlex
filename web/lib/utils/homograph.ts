// Word parts spelled alike but unrelated carry a number next to their letters: a1- (toward) and
// a2- (not), -ado1, cerc1-. Word parts never contain digits otherwise, so a run of digits is always
// that number.
const homographPattern = /^(?<letters>.*?)(?<number>\d+)(?<hyphen>-?)$/

export interface HomographParts {
  letters: string
  number: string
  hyphen: string
}

export function splitHomograph(text: string): HomographParts | null {
  const groups = homographPattern.exec(text)?.groups
  if (!groups) return null
  return {
    letters: groups.letters ?? '',
    number: groups.number ?? '',
    hyphen: groups.hyphen ?? '',
  }
}

const superscriptDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

// For places that only take plain text, such as page titles: a1- becomes a¹-.
export function homographText(text: string): string {
  return text.replace(/\d/g, (digit) => superscriptDigits[Number(digit)] ?? digit)
}

// A word part's label as plain text, the way MorphemeLabel shows it: in²- (im-, i-).
export function morphemeLabelText({ spellings, text }: { spellings: string[]; text: string }) {
  const [first = text, ...others] = spellings
  const label = homographText(first)
  return others.length > 0 ? `${label} (${others.join(', ')})` : label
}
