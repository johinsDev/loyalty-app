"use client";

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { type Member, ROLES, type Role, team } from "../data";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Team management section: invite a teammate + edit roles + remove members.
 * Design-first — state is local, actions toast. Seam: the Better Auth
 * organization member + invitation model.
 */
export function TeamSection() {
  const t = useTranslations("Settings");
  const [members, setMembers] = useState<Member[]>(team);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("staff");

  const invite = () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setMembers((prev) => [
      ...prev,
      {
        id: `m${Date.now()}`,
        name: email.split("@")[0] ?? email,
        email,
        role: inviteRole,
      },
    ]);
    toast.success(t("team.invite"));
    setInviteEmail("");
    setInviteRole("staff");
  };

  const changeRole = (id: string, role: Role) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));

  const remove = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast.success(t("team.remove"));
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("team.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("team.desc")}</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("team.invitePlaceholder")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={t("team.invitePlaceholder")}
            className="h-10 flex-1"
          />
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as Role)}
          >
            <SelectTrigger size="lg" className="text-sm sm:w-44">
              <SelectValue>
                {(value) => t(`team.role.${value as Role}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`team.role.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={invite} className="h-10">
            {t("team.invite")}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("team.col.member")}</TableHead>
            <TableHead>{t("team.col.email")}</TableHead>
            <TableHead>{t("team.col.role")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span className="bg-primary/10 text-primary font-display grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
                    {initials(m.name)}
                  </span>
                  <span className="font-semibold">{m.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{m.email}</TableCell>
              <TableCell>
                <Select
                  value={m.role}
                  onValueChange={(v) => changeRole(m.id, v as Role)}
                >
                  <SelectTrigger size="lg" className="w-36 text-sm">
                    <SelectValue>
                      {(value) => t(`team.role.${value as Role}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`team.role.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(m.id)}
                  className="text-muted-foreground hover:text-destructive size-8"
                  aria-label={t("team.remove")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
