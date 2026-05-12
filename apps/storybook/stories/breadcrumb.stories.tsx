import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@loyalty/ui";

const meta = { title: "Components/Breadcrumb", component: Breadcrumb, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Breadcrumb><BreadcrumbList>
      <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem><BreadcrumbLink href="/admin">Admin</BreadcrumbLink></BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem><BreadcrumbPage>Settings</BreadcrumbPage></BreadcrumbItem>
    </BreadcrumbList></Breadcrumb>
  ),
};
