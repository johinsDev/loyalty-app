import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@loyalty/ui";

const meta = { title: "Components/Pagination", component: Pagination, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Pagination><PaginationContent>
      <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
      <PaginationItem><PaginationLink href="#">1</PaginationLink></PaginationItem>
      <PaginationItem><PaginationLink href="#" isActive>2</PaginationLink></PaginationItem>
      <PaginationItem><PaginationLink href="#">3</PaginationLink></PaginationItem>
      <PaginationItem><PaginationEllipsis /></PaginationItem>
      <PaginationItem><PaginationNext href="#" /></PaginationItem>
    </PaginationContent></Pagination>
  ),
};
