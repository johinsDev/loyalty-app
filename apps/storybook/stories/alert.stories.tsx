import { Alert, AlertDescription, AlertTitle } from "@loyalty/ui";
import { Terminal } from "lucide-react";

const meta = { title: "Components/Alert", component: Alert, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <Alert className="w-96"><Terminal className="size-4" /><AlertTitle>Heads up</AlertTitle><AlertDescription>Your changes have been saved.</AlertDescription></Alert>
  ),
};
export const Destructive = {
  render: () => (
    <Alert variant="destructive" className="w-96"><AlertTitle>Error</AlertTitle><AlertDescription>Could not connect to the server.</AlertDescription></Alert>
  ),
};
