import { Stepper } from "@loyalty/ui";

const meta = { title: "Components/Stepper", component: Stepper, tags: ["autodocs"] };
export default meta;

const steps = [
  { key: "segment", label: "Segment" },
  { key: "products", label: "Products" },
  { key: "branding", label: "Branding" },
  { key: "schedule", label: "Schedule" },
];

export const FirstStep = {
  render: () => (
    <Stepper steps={steps} current="segment" completed={[]} />
  ),
};

export const MidProgress = {
  render: () => (
    <Stepper steps={steps} current="branding" completed={["segment", "products"]} />
  ),
};

export const AllDone = {
  render: () => (
    <Stepper
      steps={steps}
      current="review"
      completed={["segment", "products", "branding", "schedule"]}
    />
  ),
};

export const Navigable = {
  render: () => (
    <Stepper
      steps={steps}
      current="branding"
      completed={["segment", "products"]}
      onSelect={(key) => console.log("go to", key)}
    />
  ),
};
