import { useEffect, useState } from "react"

export function Toast({ notice }: { notice: { key: number; message: string } | null }) {
  const [visible, setVisible] = useState<typeof notice>(null)
  useEffect(() => {
    if (!notice) return
    setVisible(notice)
    const timer = setTimeout(() => setVisible(null), 3200)
    return () => clearTimeout(timer)
  }, [notice])
  if (!visible) return null
  return (
    <div className="toast" role="status" key={visible.key}>
      {visible.message}
    </div>
  )
}
