import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Button } from "@loyalty/ui";

const meta = { title: "Components/AlertDialog", component: AlertDialog, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Delete</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Continue</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
