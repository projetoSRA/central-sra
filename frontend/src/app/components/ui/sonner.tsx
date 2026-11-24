"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";
import { useTema } from "../../utils/tema";

// Os avisos seguem o modo claro/escuro do sistema (utils/tema.ts).
const Toaster = ({ ...props }: ToasterProps) => {
  const { tema } = useTema();

  return (
    <Sonner
      theme={tema}
      position="top-center"
      richColors
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
