import { InputOTP, InputOTPGroup, InputOTPSlot } from "@loyalty/ui";

const meta = { title: "Components/InputOTP", component: InputOTP, tags: ["autodocs"] };
export default meta;

export const Default = {
  render: () => (
    <InputOTP maxLength={6}>
      <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
    </InputOTP>
  ),
};
