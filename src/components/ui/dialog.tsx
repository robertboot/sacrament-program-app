"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * True iOS-safe body scroll-lock, driven by observing which dialog
 * popups are actually open in the DOM.
 *
 * Why observation, not React lifecycle: Base UI keeps popups mounted
 * during their close animation and consumers put
 * <Dialog><DialogContent>…</DialogContent></Dialog> in JSX
 * unconditionally, so hooking into DialogContent's mount / effect
 * lifecycle either locks too early (page-load) or releases too late
 * (post-animation). A single MutationObserver watching for
 * `[data-slot="dialog-content"][data-open]` on the whole document is
 * immune to that timing — the body is locked iff at least one dialog
 * currently reports itself as open.
 *
 * Base UI's own modal scroll-lock puts overflow:hidden on <html>,
 * which iOS Safari happily ignores. The only reliable iOS fix is to
 * pin body with position:fixed while remembering the scroll offset,
 * disable user-select, and kill touch-action so a stray touch on
 * body can't drift the viewport sideways.
 */
let bodyLockEngaged = false
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
  touchAction: string
} | null = null

function lockBodyNow() {
  if (typeof document === "undefined" || bodyLockEngaged) return
  bodyLockEngaged = true
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
    touchAction: style.touchAction,
  }
  style.position = "fixed"
  style.top = `-${bodyLockScrollY}px`
  style.left = "0"
  style.right = "0"
  style.width = "100%"
  style.overflow = "hidden"
  style.userSelect = "none"
  style.webkitUserSelect = "none"
  style.touchAction = "none"
}

function unlockBodyNow() {
  if (typeof document === "undefined" || !bodyLockEngaged || !bodyLockPrev) return
  bodyLockEngaged = false
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
  style.touchAction = bodyLockPrev.touchAction
  bodyLockPrev = null
  window.scrollTo(0, bodyLockScrollY)
}

let dialogObserverStarted = false

function startDialogObserver() {
  if (dialogObserverStarted || typeof document === "undefined") return
  dialogObserverStarted = true

  const evaluate = () => {
    // Body is locked iff at least one popup has data-open. Base UI adds
    // data-open when the popup enters open state and swaps to data-closed
    // while animating out, so the observation matches the on-screen state.
    const anyOpen = document.querySelector(
      '[data-slot="dialog-content"][data-open]',
    )
    if (anyOpen) lockBodyNow()
    else unlockBodyNow()
  }

  const observer = new MutationObserver(evaluate)
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-open", "data-closed"],
  })
  evaluate()
}

/**
 * Idempotently starts the global dialog observer. Rendered inside every
 * DialogContent — the observer itself does nothing until a popup with
 * data-open exists, so mounting it on page paint is harmless.
 */
function DialogObserverStart() {
  React.useEffect(() => {
    startDialogObserver()
  }, [])
  return null
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
        // touch-none stops touches on the backdrop from triggering iOS
        // side-swipe navigation or horizontal pans on the page behind.
        "fixed inset-0 isolate z-50 bg-black/10 touch-none duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
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
          // touch-pan-y + overscroll-none lock scrolling to vertical only
          // and kill iOS overscroll — a slight diagonal touch was letting
          // iOS interpret the gesture as a horizontal pan (or back-swipe),
          // so pulling down inside the dialog visibly slid it sideways.
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] max-h-[90svh] overflow-y-auto overscroll-none touch-pan-y -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        <DialogObserverStart />
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
