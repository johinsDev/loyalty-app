import {
  Dropzone,
  DropzoneArea,
  DropzoneDescription,
  DropzoneIcon,
  DropzoneLabel,
  DropzoneList,
  DropzoneListItem,
  DropzoneRejections,
} from "@loyalty/ui";

const meta = {
  title: "Storage/Dropzone",
  component: Dropzone,
  tags: ["autodocs"],
};
export default meta;

const baseShell = (children: React.ReactNode) => (
  <div className="mx-auto w-full max-w-md">{children}</div>
);

export const Default = {
  render: () =>
    baseShell(
      <Dropzone onDrop={() => undefined}>
        <DropzoneArea>
          <DropzoneIcon />
          <DropzoneLabel>Subí o arrastrá tu foto</DropzoneLabel>
          <DropzoneDescription>JPG, PNG hasta 5MB</DropzoneDescription>
        </DropzoneArea>
      </Dropzone>,
    ),
};

export const ImagesOnly = {
  render: () =>
    baseShell(
      <Dropzone
        accept={{ "image/*": [] }}
        maxFiles={1}
        onDrop={() => undefined}
      >
        <DropzoneArea>
          <DropzoneIcon />
          <DropzoneLabel>Subí una imagen</DropzoneLabel>
          <DropzoneDescription>Solo imágenes (JPG, PNG, WEBP)</DropzoneDescription>
        </DropzoneArea>
        <DropzoneRejections />
      </Dropzone>,
    ),
};

export const Disabled = {
  render: () =>
    baseShell(
      <Dropzone disabled>
        <DropzoneArea>
          <DropzoneIcon />
          <DropzoneLabel>No podés subir</DropzoneLabel>
          <DropzoneDescription>Estado deshabilitado</DropzoneDescription>
        </DropzoneArea>
      </Dropzone>,
    ),
};

export const WithFileList = {
  render: () =>
    baseShell(
      <Dropzone onDrop={() => undefined}>
        <DropzoneArea>
          <DropzoneIcon />
          <DropzoneLabel>Subí archivos</DropzoneLabel>
        </DropzoneArea>
        <DropzoneList>
          <DropzoneListItem
            name="documento.pdf"
            size={524288}
            contentType="application/pdf"
            status="success"
            progress={100}
            onRemove={() => undefined}
          />
          <DropzoneListItem
            name="captura.png"
            size={1024 * 1024 * 2}
            contentType="image/png"
            status="uploading"
            progress={45}
          />
          <DropzoneListItem
            name="muy-grande.zip"
            size={1024 * 1024 * 200}
            contentType="application/zip"
            status="error"
            errorMessage="File too large"
            onRemove={() => undefined}
          />
        </DropzoneList>
      </Dropzone>,
    ),
};

export const SingleItemStates = {
  render: () => (
    <div className="mx-auto w-full max-w-md space-y-3">
      <DropzoneListItem
        name="queued.png"
        size={51200}
        contentType="image/png"
        status="queued"
        progress={0}
      />
      <DropzoneListItem
        name="uploading.png"
        size={51200}
        contentType="image/png"
        status="uploading"
        progress={62}
      />
      <DropzoneListItem
        name="success.png"
        size={51200}
        contentType="image/png"
        status="success"
        progress={100}
        thumbnailUrl="https://github.com/shadcn.png"
        onRemove={() => undefined}
      />
      <DropzoneListItem
        name="error.png"
        size={51200}
        contentType="image/png"
        status="error"
        progress={30}
        errorMessage="Network error"
        onRemove={() => undefined}
      />
    </div>
  ),
};
