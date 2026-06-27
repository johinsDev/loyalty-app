import type { AddressFieldLabels } from "@loyalty/ui";
import { useTranslations } from "next-intl";

/** Maps the `Address` message group to the `AddressField` label props (the
 *  component is i18n-agnostic — strings are injected). Shared by the store
 *  editor and the settings location section. */
export function useAddressLabels(): AddressFieldLabels {
  const t = useTranslations("Address");
  return {
    searchPlaceholder: t("searchPlaceholder"),
    manualEntry: t("manualEntry"),
    edit: t("edit"),
    clear: t("clear"),
    modalTitle: t("modalTitle"),
    line1: t("line1"),
    line2: t("line2"),
    city: t("city"),
    state: t("state"),
    postalCode: t("postalCode"),
    country: t("country"),
    mapHint: t("mapHint"),
    save: t("save"),
    cancel: t("cancel"),
  };
}
