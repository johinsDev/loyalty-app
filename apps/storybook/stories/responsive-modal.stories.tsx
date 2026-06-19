import {
  Button,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useState } from "react";

const meta = {
  title: "Components/ResponsiveModal",
  component: ResponsiveModal,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Bottom Drawer on mobile, centered medium Dialog on desktop. Resize the viewport (≥768px = Dialog) to see both presentations.",
      },
    },
  },
};
export default meta;

export const Default = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir</Button>
        <ResponsiveModal open={open} onOpenChange={setOpen}>
          <ResponsiveModalContent>
            <ResponsiveModalHeader>
              <ResponsiveModalTitle>Canjear recompensa</ResponsiveModalTitle>
              <ResponsiveModalDescription>
                Mobile lo muestra como drawer; desktop como dialog centrado.
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <div className="px-4 pb-2 text-sm">
              Contenido libre del modal.
            </div>
            <ResponsiveModalFooter>
              <Button
                variant="gradient"
                size="lg"
                className="h-13 rounded-full text-base"
              >
                Canjear
              </Button>
              <ResponsiveModalClose>Cerrar</ResponsiveModalClose>
            </ResponsiveModalFooter>
          </ResponsiveModalContent>
        </ResponsiveModal>
      </>
    );
  },
};
