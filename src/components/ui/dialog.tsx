"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * True iOS-safe body scroll-lock. Base UI's built-in modal scroll-lock
 * sets overflow:hidden on <html>, which iOS Safari happily ignores —
 * touch drags on the page behind still scroll it, and tap targets
 * behind the dialog stay selectable. The only reliable fix on iOS is
 * to fix the body element in place while remembering the scroll
 * position, then restore it on close.
 *
 * Uses ref-counting so nested dialogs (dialog inside a dialog) don't
 * fight over the lock — only the outermost releases it.
 */
let bodyLockDepth = 0
let bodyLockScrollY = 0
let bodyLockPrev: {
  position: string
  top: string
  left: string
  right: string
  width: string
  overflow: string
  userSelect: string
  webkitUserSelect: string
} | null = null

function acquireBodyLock() {
  if (typeof document === "undefined") return
  bodyLockDepth += 1
  if (bodyLockDepth > 1) return
  const body = document.body
  const style = body.style as CSSStyleDeclaration & { webkitUserSelect?: string }
  bodyLockScrollY = window.scrollY || window.pageYOffset || 0
  bodyLockPrev = {
    position: style.position,
    top: style.top,
    left: style.left,
    right: style.right,
    width: style.width,
    overflow: style.overflow,
    userSelect: style.userSelect,
    webkitUserSelect: style.webkitUserSelect ?? "",
  }
  style.position = "fixed"
  style.top = `-${bodyLockScrollY}px`
  style.left = "0"
  style.right = "0"
  style.width = "100%"
  style.overflow = "hidden"
  style.userSelect = "none"
  style.webkitUserSelect = "none"
}

function releaseBodyLock() {
  if (typeof document === "undefined") return
  bodyLockDepth = Math.max(0, bodyLockDepth - 1)
  if (bodyLockDepth > 0 || !bodyLockPrev) return
  const body = document.body
  const style = body.style as CSSStyleDeclaration & { webkitUserSelect?: string }
  style.position = bodyLockPrev.position
  style.top = bodyLockPrev.top
  style.left = bodyLockPrev.left
  style.right = bodyLockPrev.right
  style.width = bodyLockPrev.width
  style.overflow = bodyLockPrev.overflow
  style.userSelect = bodyLockPrev.userSelect
  style.webkitUserSelect = bodyLockPrev.webkitUserSelect
  bodyLockPrev = null
  window.scrollTo(0, bodyLockScrollY)
}

function useBodyScrollLock() {
  React.useEffect(() => {
    acquireBodyLock()
    return () => releaseBodyLock()
  }, [])
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  useBodyScrollLock()
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // Base UI centers the popup with `top-1/2 -translate-y-1/2`, so a
          // dialog taller than the viewport gets clipped at BOTH ends — the
          // close (X) at the top and the footer buttons at the bottom become
          // unreachable on phones. Cap the height and let the popup itself
          // scroll so nothing is ever unreachable.
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] max-h-[90svh] overflow-y-auto overscroll-contain -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {showCloseButton && (
          // Sticky top-0 wrapper keeps the X reachable when the popup
          // scrolls internally. h-0 + negative margins mean the wrapper
          // takes no layout space; the absolute-positioned X sits in
          // the popup's visible top-right corner as before.
          <div className="pointer-events-none sticky top-0 z-10 -mx-4 -mt-4 h-0 order-first">
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  className="pointer-events-auto absolute top-2 right-2"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        )}
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-snug font-medium pr-8",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
