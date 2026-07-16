import {
  STAMP_CARD_TEMPLATES,
  StampCardTemplate,
  type StampCardView,
} from "@loyalty/ui";

const meta = {
  title: "Components/StampCardTemplates",
  component: StampCardTemplate,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;

const STAR_ICON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8-6.1-3.4-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z'/></svg>";

const view: StampCardView = {
  goal: 9,
  filledInCycle: 6,
  totalStamps: 12,
  pending: null,
  icon: { kind: "lucide", value: "cup-soda" },
  onColor: null,
  offStyle: "number",
  title: "Tus sellos",
  subtitle: "¡Te faltan 3 para tu premio!",
  countLabel: "12 sellos",
  pendingLabel: null,
  pausedLabel: null,
  prizeName: "Bebida gratis",
  spotAriaLabel: (s) =>
    `Sello ${s.index} de 10, ${
      s.kind === "filled" ? "ganado" : s.kind === "reward" ? "premio" : "pendiente"
    }`,
};

export const AllTemplates = {
  render: () => (
    <div className="grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {STAMP_CARD_TEMPLATES.map((t) => (
        <div key={t.key} data-template={t.key}>
          <StampCardTemplate template={t.key} view={view} />
          <p className="mt-2 text-center text-xs font-bold">{t.name.es}</p>
        </div>
      ))}
    </div>
  ),
};

export const Goals = {
  render: () => (
    <div className="grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {[3, 4, 6, 7, 9, 12].map((goal) => (
        <div key={goal}>
          <StampCardTemplate
            template="classic"
            view={{
              ...view,
              goal,
              filledInCycle: Math.min(view.filledInCycle, goal - 1),
            }}
          />
          <p className="mt-2 text-center text-xs font-bold">Meta {goal}</p>
        </div>
      ))}
    </div>
  ),
};

export const OffStyles = {
  render: () => (
    <div className="grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
      {(["dim", "outline", "number"] as const).map((offStyle) => (
        <div key={offStyle}>
          <StampCardTemplate template="classic" view={{ ...view, offStyle }} />
          <p className="mt-2 text-center text-xs font-bold">{offStyle}</p>
        </div>
      ))}
    </div>
  ),
};

export const ImageIcon = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
      {(["classic", "neon"] as const).map((template) => (
        <div key={template}>
          <StampCardTemplate
            template={template}
            view={{
              ...view,
              icon: { kind: "image", value: STAR_ICON },
              offStyle: "outline",
            }}
          />
          <p className="mt-2 text-center text-xs font-bold">{template}</p>
        </div>
      ))}
    </div>
  ),
};

export const Paused = {
  render: () => (
    <div className="max-w-sm">
      <StampCardTemplate
        template="classic"
        view={{
          ...view,
          pausedLabel: "Sellos en pausa — podés canjear lo que tenés.",
        }}
      />
    </div>
  ),
};
