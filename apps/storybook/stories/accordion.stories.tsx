import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@loyalty/ui";

const meta = { title: "Components/Accordion", component: Accordion, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Accordion className="w-80">
      <AccordionItem value="1">
        <AccordionTrigger>¿Cómo gano puntos?</AccordionTrigger>
        <AccordionContent>Acumulás un sello por cada compra.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="2">
        <AccordionTrigger>¿Cuándo expiran?</AccordionTrigger>
        <AccordionContent>Los puntos no expiran durante el pilot.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
