export function GuessHogLogo({ as: Tag = "h1" }: { as?: "h1" | "div" }) {
  return (
    <Tag className="logo display" aria-label="GuessHog">
      <span className="logo-hog" aria-hidden="true">
        <img src="/hoggies/magnifying-glass.webp" alt="" />
        <span className="logo-lens">?</span>
      </span>
      <span className="logo-word" aria-hidden="true">
        <span className="guess">Guess</span>
        <span className="hog">Hog</span>
      </span>
    </Tag>
  )
}
