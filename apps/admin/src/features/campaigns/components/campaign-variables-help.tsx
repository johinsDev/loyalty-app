"use client";

import {
  Badge,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ScrollArea,
} from "@loyalty/ui";
import { Link2, Store, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Row = { label: string; token: string; desc: string; example: string };
type Section = { title: string; icon: LucideIcon; rows: Row[] };

/**
 * Plain-language help for merge variables — built for non-technical staff.
 * Explains that variables auto-fill with each customer's real data at send, and
 * lists every one with a friendly description + a concrete example value.
 */
const SECTIONS: Section[] = [
  {
    title: "Del cliente",
    icon: User,
    rows: [
      { label: "Nombre de usuario", token: "{{user.name}}", desc: "El nombre del cliente.", example: "Ana" },
      { label: "Teléfono", token: "{{user.phone}}", desc: "El teléfono del cliente.", example: "300 123 4567" },
      { label: "Nivel", token: "{{user.tier}}", desc: "Su nivel actual en el programa.", example: "Oro" },
      { label: "Puntos", token: "{{user.points}}", desc: "Puntos disponibles del cliente.", example: "1.200" },
      { label: "Sellos", token: "{{user.stamps}}", desc: "Sellos en su tarjeta activa.", example: "7" },
    ],
  },
  {
    title: "De la sucursal",
    icon: Store,
    rows: [
      { label: "Sucursal", token: "{{store.name}}", desc: "El nombre de la sucursal.", example: "T4 Colina" },
      { label: "Dirección", token: "{{store.address}}", desc: "La dirección de la sucursal.", example: "Cra 1 #2-3, Bogotá" },
      { label: "Tel. sucursal", token: "{{store.phone}}", desc: "El teléfono de la sucursal.", example: "312 345 6789" },
      { label: "Instagram", token: "{{store.instagram}}", desc: "El Instagram de la sucursal.", example: "@t4lovers" },
    ],
  },
];

export function CampaignVariablesHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Cómo funcionan las variables</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <ScrollArea className="max-h-[70dvh]">
          <div className="space-y-5 p-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Las variables se reemplazan <strong className="text-foreground">solas</strong> por
              los datos reales de cada cliente cuando se envía el mensaje. Así cada persona ve su
              propio nombre, sus puntos, etc. Escribe{" "}
              <code className="bg-muted rounded px-1 font-mono text-xs">{"{{"}</code> en el mensaje
              para insertarlas.
            </p>

            {SECTIONS.map((section) => (
              <div key={section.title} className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
                  <section.icon className="size-3.5" />
                  {section.title}
                </div>
                <div className="border-border divide-border divide-y overflow-hidden rounded-2xl border">
                  {section.rows.map((r) => (
                    <div key={r.token} className="flex items-start gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{r.label}</p>
                        <p className="text-muted-foreground text-xs">{r.desc}</p>
                        <code className="text-muted-foreground/80 font-mono text-[11px]">
                          {r.token}
                        </code>
                      </div>
                      <Badge variant="secondary" className="shrink-0 font-normal">
                        Ej: {r.example}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
                <Link2 className="size-3.5" />
                Contenido con enlace
              </div>
              <div className="border-border rounded-2xl border p-3">
                <p className="text-sm">
                  <strong>Promoción · Producto · Categoría · Recompensa</strong>
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Inserta el nombre de una promo, producto, categoría o recompensa como un{" "}
                  <strong className="text-foreground">enlace</strong> a esa página. Puedes{" "}
                  <strong className="text-foreground">cambiar el texto visible</strong> (por
                  ejemplo escribir “2x1”) sin que cambie el enlace. Nosotros lo acortamos
                  automáticamente para que el mensaje sea corto.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
