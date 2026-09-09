import {
  Gauge, Sun, ListTodo, FolderKanban, Stamp, Calendar, ClipboardCheck,
  Megaphone, Share2, MessageCircle, Palette, Images, ShoppingBag, TrendingUp,
  Package, FileCheck, Award, FileText, LifeBuoy, MessagesSquare, Building2, Gem,
  Globe, Users, UserRound, Clock, BookOpen, Folder, MessageSquare, Wallet,
  Receipt, CreditCard, BarChart3, PieChart, UserCog, KeyRound, History, Terminal,
  Activity, Settings, Workflow, type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/i18n";

export interface NavItem {
  key: string;
  labelKey: TranslationKey;
  href: string;
  icon: LucideIcon;
  /** Permission required to SEE this item (canAnywhere). null = always visible. */
  permission: string | null;
}

export interface NavGroup {
  labelKey: TranslationKey | null; // null = ungrouped top items
  items: NavItem[];
}

/** Cmd/Ctrl-K "Create …" commands (§29). Each deep-links to the module's list
 *  page with `?new=1`, which the list page's create control opens automatically
 *  (see useCreateShortcut). Gated by the `<permission>` (canAnywhere). */
export interface CreateCommand {
  key: string;
  label: string;
  href: string;
  permission: string;
}

export const CREATE_COMMANDS: CreateCommand[] = [
  { key: "task", label: "Create task", href: "/tasks?new=1", permission: "tasks.create" },
  { key: "campaign", label: "Create campaign", href: "/campaigns?new=1", permission: "campaigns.create" },
  { key: "social", label: "Create social post", href: "/social?new=1", permission: "social.create" },
  { key: "whatsapp", label: "Create WhatsApp campaign", href: "/whatsapp?new=1", permission: "whatsapp.create" },
  { key: "design", label: "Create design request", href: "/design?new=1", permission: "design.create" },
  { key: "product", label: "Create product", href: "/products?new=1", permission: "products.create" },
  { key: "registration", label: "Create registration case", href: "/registrations?new=1", permission: "registrations.create" },
  { key: "case", label: "Create customer case", href: "/cases?new=1", permission: "cases.create" },
  { key: "answer", label: "Create approved answer", href: "/answers?new=1", permission: "answers.create" },
  { key: "article", label: "Create knowledge article", href: "/knowledge?new=1", permission: "knowledge.create" },
  { key: "channel", label: "Create discussion channel", href: "/discussions?new=1", permission: "discussions.create" },
  { key: "file", label: "Upload file", href: "/files?new=1", permission: "files.create" },
  { key: "approval", label: "Create approval request", href: "/approvals?new=1", permission: "approvals.manage" },
  { key: "subscription", label: "Create subscription", href: "/subscriptions?new=1", permission: "subscriptions.create" },
  { key: "workflow", label: "Create workflow", href: "/workflows?new=1", permission: "workflows.create" },
  { key: "company", label: "Create company", href: "/companies?new=1", permission: "companies.create" },
  { key: "brand", label: "Create brand", href: "/brands?new=1", permission: "brands.create" },
  { key: "market", label: "Create market", href: "/markets?new=1", permission: "markets.create" },
  { key: "team", label: "Create team", href: "/teams?new=1", permission: "teams.create" },
  { key: "employee", label: "Create employee", href: "/employees?new=1", permission: "employees.create" },
  { key: "project", label: "Create project", href: "/projects?new=1", permission: "projects.create" },
];

export const NAVIGATION: NavGroup[] = [
  {
    labelKey: null,
    items: [
      { key: "command-center", labelKey: "nav.commandCenter", href: "/", icon: Gauge, permission: null },
      { key: "my-day", labelKey: "nav.myDay", href: "/my-day", icon: Sun, permission: null },
    ],
  },
  {
    labelKey: "nav.group.work",
    items: [
      { key: "tasks", labelKey: "nav.tasks", href: "/tasks", icon: ListTodo, permission: "tasks.view" },
      { key: "projects", labelKey: "nav.projects", href: "/projects", icon: FolderKanban, permission: "projects.view" },
      { key: "approvals", labelKey: "nav.approvals", href: "/approvals", icon: Stamp, permission: "approvals.view" },
      { key: "daily-checks", labelKey: "nav.dailyChecks", href: "/daily-checks", icon: ClipboardCheck, permission: "daily_checks.view" },
      { key: "calendar", labelKey: "nav.calendar", href: "/calendar", icon: Calendar, permission: "tasks.view" },
    ],
  },
  {
    labelKey: "nav.group.marketing",
    items: [
      { key: "campaigns", labelKey: "nav.campaigns", href: "/campaigns", icon: Megaphone, permission: "campaigns.view" },
      { key: "social", labelKey: "nav.social", href: "/social", icon: Share2, permission: "social.view" },
      { key: "whatsapp", labelKey: "nav.whatsapp", href: "/whatsapp", icon: MessageCircle, permission: "whatsapp.view" },
    ],
  },
  {
    labelKey: "nav.group.creative",
    items: [
      { key: "design", labelKey: "nav.design", href: "/design", icon: Palette, permission: "design.view" },
      { key: "creative-library", labelKey: "nav.creativeLibrary", href: "/creative-library", icon: Images, permission: "creative_library.view" },
    ],
  },
  {
    labelKey: "nav.group.commerce",
    items: [
      { key: "stores", labelKey: "nav.stores", href: "/stores", icon: ShoppingBag, permission: "stores.view" },
      { key: "sales", labelKey: "nav.sales", href: "/sales", icon: TrendingUp, permission: "sales.view" },
      { key: "products", labelKey: "nav.products", href: "/products", icon: Package, permission: "products.view" },
    ],
  },
  {
    labelKey: "nav.group.regulatory",
    items: [
      { key: "registrations", labelKey: "nav.registrations", href: "/registrations", icon: FileCheck, permission: "registrations.view" },
      { key: "certificates", labelKey: "nav.certificates", href: "/certificates", icon: Award, permission: "documents.view" },
      { key: "documents", labelKey: "nav.documents", href: "/documents", icon: FileText, permission: "documents.view" },
    ],
  },
  {
    labelKey: "nav.group.customerService",
    items: [
      { key: "cases", labelKey: "nav.cases", href: "/cases", icon: LifeBuoy, permission: "cases.view" },
      { key: "answers", labelKey: "nav.answers", href: "/answers", icon: MessagesSquare, permission: "answers.view" },
    ],
  },
  {
    labelKey: "nav.group.organization",
    items: [
      { key: "companies", labelKey: "nav.companies", href: "/companies", icon: Building2, permission: "companies.view" },
      { key: "brands", labelKey: "nav.brands", href: "/brands", icon: Gem, permission: "brands.view" },
      { key: "markets", labelKey: "nav.markets", href: "/markets", icon: Globe, permission: "markets.view" },
      { key: "teams", labelKey: "nav.teams", href: "/teams", icon: Users, permission: "teams.view" },
      { key: "employees", labelKey: "nav.employees", href: "/employees", icon: UserRound, permission: "employees.view" },
      { key: "attendance", labelKey: "nav.attendance", href: "/attendance", icon: Clock, permission: "attendance.view" },
    ],
  },
  {
    labelKey: "nav.group.knowledge",
    items: [
      { key: "knowledge", labelKey: "nav.knowledge", href: "/knowledge", icon: BookOpen, permission: "knowledge.view" },
      { key: "files", labelKey: "nav.files", href: "/files", icon: Folder, permission: "files.view" },
    ],
  },
  {
    labelKey: "nav.group.communication",
    items: [
      { key: "discussions", labelKey: "nav.discussions", href: "/discussions", icon: MessageSquare, permission: "discussions.view" },
    ],
  },
  {
    labelKey: "nav.group.finance",
    items: [
      { key: "finance", labelKey: "nav.financeOverview", href: "/finance", icon: Wallet, permission: "finance.view" },
      { key: "expenses", labelKey: "nav.expenses", href: "/expenses", icon: Receipt, permission: "expenses.view" },
      { key: "subscriptions", labelKey: "nav.subscriptions", href: "/subscriptions", icon: CreditCard, permission: "subscriptions.view" },
    ],
  },
  {
    labelKey: "nav.group.intelligence",
    items: [
      { key: "analytics", labelKey: "nav.analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
      { key: "reports", labelKey: "nav.reports", href: "/reports", icon: PieChart, permission: "reports.view" },
    ],
  },
  {
    labelKey: "nav.group.administration",
    items: [
      { key: "users", labelKey: "nav.users", href: "/admin/users", icon: UserCog, permission: "users.view" },
      { key: "workflows", labelKey: "nav.workflows", href: "/workflows", icon: Workflow, permission: "workflows.view" },
      { key: "permissions", labelKey: "nav.permissions", href: "/admin/permissions", icon: KeyRound, permission: "permissions.manage" },
      { key: "audit", labelKey: "nav.auditLog", href: "/admin/audit", icon: History, permission: "audit.view" },
      { key: "developer", labelKey: "nav.developer", href: "/admin/developer", icon: Terminal, permission: "developer.view" },
      { key: "system-health", labelKey: "nav.systemHealth", href: "/admin/system", icon: Activity, permission: "developer.view" },
      { key: "settings", labelKey: "nav.settings", href: "/admin/settings", icon: Settings, permission: "settings.view" },
    ],
  },
];
