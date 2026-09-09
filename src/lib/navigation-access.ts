import { NAVIGATION, CREATE_COMMANDS, type CreateCommand } from "@/config/navigation";
import { canAnywhere, type Principal } from "@/lib/permissions/engine";

/** Which navigation item keys this principal is allowed to see (§4 nav adapts to permissions). */
export function allowedNavKeys(principal: Principal): string[] {
  const keys: string[] = [];
  for (const group of NAVIGATION) {
    for (const item of group.items) {
      if (item.permission === null || canAnywhere(principal, item.permission)) {
        keys.push(item.key);
      }
    }
  }
  return keys;
}

/** The Cmd-K "Create …" commands this principal is permitted to run (§29). */
export function allowedCreateCommands(principal: Principal): CreateCommand[] {
  return CREATE_COMMANDS.filter((c) => canAnywhere(principal, c.permission));
}
