import {
    PlusCircle, CheckCircle2, Users, MessagesSquare, FileEdit,
    Phone, Package, ClipboardCheck, FileText, Upload, ShieldCheck,
    CreditCard, Truck, TruckIcon, ShieldAlert, LayoutGrid, AlertCircle, XCircle,
    Settings, UserCog
} from "lucide-react";

export const STAGES = [
    { num: 1, name: "Create Indent", slug: "create-indent", icon: PlusCircle },
    { num: 2, name: "Delegate for Approval", slug: "delegate-approval", icon: UserCog },
    { num: 3, name: "Indent Approval", slug: "indent-approval", icon: CheckCircle2 },
    { num: 4, name: "Quotation", slug: "quotation", icon: MessagesSquare },
    { num: 5, name: "Approved Vendor", slug: "approved-vendor", icon: ShieldCheck },
    { num: 6, name: "Make PO", slug: "po-entry", icon: FileEdit },
    { num: 7, name: "Payment", slug: "payment", icon: CreditCard },
    { num: 8, name: "Follow UP / Lifting", slug: "follow-up-vendor", icon: Phone },
    { num: 9, name: "Transporter Follow-Up", slug: "transporter-follow-up", icon: TruckIcon },
    { num: 10, name: "Material Received", slug: "material-received", icon: Package },
    { num: 11, name: "Billing", slug: "receipt-in-tally", icon: FileText },
    { num: 12, name: "Order Cancel", slug: "order-cancel", icon: XCircle },
    { num: 13, name: "Master", slug: "master", icon: LayoutGrid },
    { num: 14, name: "Settings", slug: "settings", icon: Settings },
];
