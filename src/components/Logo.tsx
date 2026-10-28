import { Logo } from "@posthog/brand/logo"

/** The GuessHog mark with a "by PostHog" tag stuck to it. Pass onHome to make the mark a link home. */
export function GuessHogLogo({ as: Tag = "h1", onHome }: { as?: "h1" | "div"; onHome?: () => void }) {
  const mark = (
    <>
      <span className="logo-hog" aria-hidden="true">
        <img src="/hoggies/magnifying-glass.webp" alt="" />
      </span>
      <span className="logo-word" aria-hidden="true">
        <span className="guess">Guess</span>
        <span className="hog">Hog</span>
      </span>
    </>
  )
  return (
    <div className="logo-lockup">
      {onHome ? (
        <a
          href="/"
          className="logo display"
          aria-label="GuessHog home"
          onClick={(e) => {
            e.preventDefault()
            onHome()
          }}
        >
          {mark}
        </a>
      ) : (
        <Tag className="logo display" aria-label="GuessHog">
          {mark}
        </Tag>
      )}
      <a className="logo-by" href="https://posthog.com" target="_blank" rel="noreferrer" aria-label="By PostHog">
        by <Logo style={{ height: "1.25em", width: "auto" }} />
      </a>
    </div>
  )
}
