import { Avatar, AvatarFallback, AvatarImage } from "@loyalty/ui";

const meta = { title: "Components/Avatar", component: Avatar, tags: ["autodocs"] };
export default meta;

export const Default = { render: () => (<Avatar><AvatarImage src="https://github.com/shadcn.png" /><AvatarFallback>CN</AvatarFallback></Avatar>) };
export const Fallback = { render: () => (<Avatar><AvatarFallback>JV</AvatarFallback></Avatar>) };
