import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@loyalty/ui";

const meta = { title: "Components/Table", component: Table, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Table className="w-96"><TableCaption>Recent invoices.</TableCaption>
      <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
      <TableBody>
        <TableRow><TableCell>INV001</TableCell><TableCell>Paid</TableCell><TableCell className="text-right">$250.00</TableCell></TableRow>
        <TableRow><TableCell>INV002</TableCell><TableCell>Pending</TableCell><TableCell className="text-right">$150.00</TableCell></TableRow>
      </TableBody>
    </Table>
  ),
};
