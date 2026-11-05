import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    // The mark is a local brand image, so the image optimizer is unnecessary.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      width={48}
      height={48}
      className={cn("rounded-xl object-cover shadow-md shadow-primary/25", className)}
    />
  )
}
