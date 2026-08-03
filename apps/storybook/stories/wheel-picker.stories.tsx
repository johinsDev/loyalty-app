import { WheelPicker } from "@loyalty/ui";
import { useState } from "react";

const meta = {
  title: "Components/WheelPicker",
  component: WheelPicker,
  tags: ["autodocs"],
};
export default meta;

const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

/**
 * One drum on momentum physics. Drag it, flick it, scroll it with a trackpad,
 * or focus it and use ↑ / ↓ / Home / End.
 */
export const Default = {
  render: () => {
    const [value, setValue] = useState("Mediana");
    return (
      <div className="w-48">
        <WheelPicker
          options={["Pequeña", "Mediana", "Grande", "Extra grande"]}
          value={value}
          onValueChange={setValue}
          aria-label="Tamaño"
        />
        <p className="text-muted-foreground mt-3 text-center text-sm">
          {value}
        </p>
      </div>
    );
  },
};

/** `{ label, value }` options separate what is shown from what is emitted. */
export const LabelAndValue = {
  render: () => {
    const [value, setValue] = useState("md");
    return (
      <div className="w-48">
        <WheelPicker
          options={[
            { label: "Pequeña", value: "sm" },
            { label: "Mediana", value: "md" },
            { label: "Grande", value: "lg" },
          ]}
          value={value}
          onValueChange={setValue}
          aria-label="Tamaño"
        />
        <p className="text-muted-foreground mt-3 text-center text-sm">
          value: <code>{value}</code>
        </p>
      </div>
    );
  },
};

/** Uncontrolled: pass `defaultValue` and let the wheel own its state. */
export const Uncontrolled = {
  render: () => (
    <div className="w-48">
      <WheelPicker
        options={MINUTES}
        defaultValue="30"
        aria-label="Minutos"
      />
    </div>
  ),
};

/** Long lists stay smooth — a hard flick coasts and springs into its detent. */
export const LongList = {
  render: () => {
    const [value, setValue] = useState("1998");
    return (
      <div className="w-32">
        <WheelPicker
          options={Array.from({ length: 120 }, (_, i) => String(1920 + i))}
          value={value}
          onValueChange={setValue}
          aria-label="Año"
        />
        <p className="text-muted-foreground mt-3 text-center text-sm">
          {value}
        </p>
      </div>
    );
  },
};

/**
 * `variant="bare"` drops the border, surface and centre-band highlight so a
 * parent can run one band across several wheels — this is how `DateWheelPicker`
 * is assembled.
 */
export const BareGroup = {
  render: () => {
    const [hour, setHour] = useState("08");
    const [minute, setMinute] = useState("30");
    return (
      <div className="w-56">
        <div className="relative flex gap-2">
          <div
            aria-hidden
            className="bg-primary/10 ring-primary/25 pointer-events-none absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-xl ring-1"
          />
          <div className="relative flex-1">
            <WheelPicker
              variant="bare"
              itemHeight={44}
              options={HOURS}
              value={hour}
              onValueChange={setHour}
              aria-label="Hora"
            />
          </div>
          <div className="relative flex-1">
            <WheelPicker
              variant="bare"
              itemHeight={44}
              options={MINUTES}
              value={minute}
              onValueChange={setMinute}
              aria-label="Minutos"
            />
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-center text-sm tabular-nums">
          {hour}:{minute}
        </p>
      </div>
    );
  },
};

/** `visibleCount` sets how many rows show through; more rows flatten the curve. */
export const VisibleCounts = {
  render: () => (
    <div className="flex items-start gap-6">
      {[3, 5, 7].map((count) => (
        <div key={count} className="w-32">
          <p className="text-muted-foreground mb-2 text-center text-xs font-bold">
            visibleCount {count}
          </p>
          <WheelPicker
            options={MINUTES}
            defaultValue="30"
            visibleCount={count}
            aria-label={`Minutos (${count} filas)`}
          />
        </div>
      ))}
    </div>
  ),
};

/** Opt-in Web Audio detent, synthesized at runtime — no asset to ship. */
export const WithSound = {
  render: () => (
    <div className="w-48">
      <WheelPicker
        options={MINUTES}
        defaultValue="15"
        sound
        aria-label="Minutos"
      />
    </div>
  ),
};

export const Disabled = {
  render: () => (
    <div className="w-48">
      <WheelPicker
        options={["Pequeña", "Mediana", "Grande"]}
        defaultValue="Mediana"
        disabled
        aria-label="Tamaño"
      />
    </div>
  ),
};
