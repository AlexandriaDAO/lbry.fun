import React from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group font-mono"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast: "group toast bg-black border border-white/30 text-white shadow-none rounded-none",
          description: "group-[.toast]:text-gray-400 text-xs",
          actionButton: "group-[.toast]:bg-lime-500 group-[.toast]:text-black group-[.toast]:border-0 group-[.toast]:font-bold group-[.toast]:rounded-none",
          cancelButton: "group-[.toast]:bg-black group-[.toast]:text-white group-[.toast]:border group-[.toast]:border-white/30 group-[.toast]:rounded-none",
          error: 'group toast bg-black border border-red-500 text-red-500 shadow-none rounded-none',
          success: 'group toast bg-black border border-lime-500 text-lime-500 shadow-none rounded-none',
          warning: 'group toast bg-black border border-yellow-500 text-yellow-500 shadow-none rounded-none',
          info: 'group toast bg-black border border-cyan-500 text-cyan-500 shadow-none rounded-none',
        },
      }}
      {...props}
    />
  )
}
export { Toaster }
