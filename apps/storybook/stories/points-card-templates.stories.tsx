import {
  POINTS_CARD_TEMPLATES,
  PointsCardTemplate,
  type PointsCardView,
} from "@loyalty/ui";

const meta = {
  title: "Components/PointsCardTemplates",
  component: PointsCardTemplate,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;

const view: PointsCardView = {
  balance: 1240,
  formatBalance: (n) => n.toLocaleString("es-CO"),
  tierName: "Flor",
  tierColor: "#f0a868",
  tierIconKey: "flower",
  progress: 0.68,
  nextTierName: "Oro",
  nextThreshold: 1200,
  nextLabel: "Te faltan 385 pts para Oro",
  maxLabel: "Nivel máximo",
  pausedLabel: null,
  detailAriaLabel: "Ver detalle de puntos",
};

export const AllTemplates = {
  render: () => (
    <div className="grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {POINTS_CARD_TEMPLATES.map((t) => (
        <div key={t.key} data-template={t.key}>
          <PointsCardTemplate template={t.key} view={view} />
          <p className="mt-2 text-center text-xs font-bold">{t.name.es}</p>
        </div>
      ))}
    </div>
  ),
};

export const Paused = {
  render: () => (
    <div className="max-w-sm">
      <PointsCardTemplate
        template="classic"
        view={{
          ...view,
          pausedLabel: "Puntos en pausa — podés canjear lo que tenés.",
          nextLabel: null,
          nextTierName: null,
        }}
      />
    </div>
  ),
};

export const TopTier = {
  render: () => (
    <div className="max-w-sm">
      <PointsCardTemplate
        template="neon"
        view={{
          ...view,
          tierName: "Oro",
          tierIconKey: "crown",
          tierColor: "#f0a868",
          nextTierName: null,
          nextThreshold: null,
          nextLabel: null,
        }}
      />
    </div>
  ),
};
