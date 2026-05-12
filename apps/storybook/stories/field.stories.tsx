import { Field, FieldDescription, FieldError, FieldLabel, Input } from "@loyalty/ui";

const meta = { title: "Components/Field", component: Field, tags: ["autodocs"], parameters: { layout: "padded" } };
export default meta;

export const Default = {
  render: () => (
    <Field className="w-72">
      <FieldLabel>Email</FieldLabel>
      <Input type="email" placeholder="me@example.com" />
      <FieldDescription>We never share your email.</FieldDescription>
    </Field>
  ),
};
export const WithError = {
  render: () => (
    <Field className="w-72" data-invalid="true">
      <FieldLabel>Email</FieldLabel>
      <Input type="email" defaultValue="not-an-email" aria-invalid="true" />
      <FieldError>Enter a valid email address.</FieldError>
    </Field>
  ),
};
