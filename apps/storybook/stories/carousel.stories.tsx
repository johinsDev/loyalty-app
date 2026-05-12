import { Card, CardContent, Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@loyalty/ui";

const meta = { title: "Components/Carousel", component: Carousel, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Carousel className="w-72">
      <CarouselContent>
        {[1, 2, 3, 4, 5].map((n) => (
          <CarouselItem key={n}><Card><CardContent className="flex aspect-square items-center justify-center p-6 text-3xl font-semibold">{n}</CardContent></Card></CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious /><CarouselNext />
    </Carousel>
  ),
};
