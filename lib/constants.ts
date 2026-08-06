import {
    PlusCircle, CheckCircle2, Users, MessagesSquare, FileEdit,
    Phone, Package, ClipboardCheck, FileText, Upload, ShieldCheck,
    CornerUpLeft, CreditCard, Truck, TruckIcon, ShieldAlert, LayoutGrid, AlertCircle, XCircle,
    Settings
} from "lucide-react";

export const STAGES = [
    { num: 1, name: "Create Indent", slug: "create-indent", icon: PlusCircle },
    { num: 2, name: "Indent Approval", slug: "indent-approval", icon: CheckCircle2 },
    { num: 3, name: "Quotation", slug: "quotation", icon: MessagesSquare },
    { num: 4, name: "Approved Vendor", slug: "approved-vendor", icon: ShieldCheck },
    { num: 5, name: "Make PO", slug: "po-entry", icon: FileEdit },
    { num: 6, name: "Payment", slug: "payment", icon: CreditCard },
    { num: 7, name: "Follow UP / Lifting", slug: "follow-up-vendor", icon: Phone },
    { num: 8, name: "Transporter Follow-Up", slug: "transporter-follow-up", icon: TruckIcon },
    { num: 9, name: "Material Received", slug: "material-received", icon: Package },
    { num: 10, name: "Purchase Return", slug: "purchase-return", icon: CornerUpLeft },
    { num: 11, name: "Billing", slug: "receipt-in-tally", icon: FileText },
    { num: 12, name: "Order Cancel", slug: "order-cancel", icon: XCircle },
    { num: 13, name: "Master", slug: "master", icon: LayoutGrid },
    { num: 14, name: "Settings", slug: "settings", icon: Settings },
];
