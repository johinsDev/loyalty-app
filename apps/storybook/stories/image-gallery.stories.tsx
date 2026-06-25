import { ImageGallery } from "@loyalty/ui";

const meta = {
  title: "Components/ImageGallery",
  component: ImageGallery,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;

const img = (seed: string) => `https://picsum.photos/seed/${seed}/1200/1200`;

export const Single = {
  render: () => (
    <div className="max-w-md">
      <ImageGallery images={[{ src: img("one"), alt: "Demo" }]} alt="Demo" />
    </div>
  ),
};

export const Multiple = {
  render: () => (
    <div className="max-w-md">
      <ImageGallery
        alt="Demo"
        images={[
          { src: img("g1") },
          { src: img("g2") },
          { src: img("g3") },
          { src: img("g4") },
        ]}
      />
    </div>
  ),
};

export const ManyWithOverflow = {
  render: () => (
    <div className="max-w-md">
      <ImageGallery
        alt="Demo"
        images={Array.from({ length: 11 }, (_, i) => ({ src: img(`m${i}`) }))}
      />
    </div>
  ),
};
