import { splitHomograph } from '@/lib/utils/homograph'

// A word part as a dictionary prints it: its most used spelling, with a homograph number as a
// small superscript (in²-), followed by the other spellings its words use, smaller: in²- (im-, i-).
export function MorphemeLabel({ spellings, text }: { spellings: string[]; text: string }) {
  const [first = text, ...others] = spellings
  const parts = splitHomograph(first)
  return (
    <>
      {parts ? (
        <>
          {parts.letters}
          <sup className="ml-px text-[0.6em] font-medium">{parts.number}</sup>
          {parts.hyphen}
        </>
      ) : (
        first
      )}
      {others.length > 0 ? (
        <span className="ml-1 text-[0.7em] font-normal text-[var(--mute)]">
          ({others.join(', ')})
        </span>
      ) : null}
    </>
  )
}
