"use client";

import { useParams } from "next/navigation";
import MasterPage from "../../../components/stages/master";
import CreateIndent from "@/components/stages/create-indent";
import DelegateApproval from "@/components/stages/delegate-approval";
import IndentApproval from "@/components/stages/indent-approval";
import Quotation from "@/components/stages/quotation";
import ApprovedVendor from "@/components/stages/approved-vendor";
import POEntry from "@/components/stages/po-entry";
import Payment from "@/components/stages/payment";
import FollowUpLifting from "@/components/stages/follow-up-lifting";
import TransporterFollowUp from "@/components/stages/transporter-follow-up";
import MaterialReceived from "@/components/stages/material-received";
import BillingStage from "@/components/stages/billing";
import OrderCancelPage from "@/components/stages/order-cancel";
import SettingsPage from "@/components/stages/settings";

const stageComponents: Record<string, React.ComponentType> = {
    "master": MasterPage,
    "settings": SettingsPage,
    "create-indent": CreateIndent,
    "delegate-approval": DelegateApproval,
    "indent-approval": IndentApproval,
    "quotation": Quotation,
    "purchase-enquiry": Quotation,
    "approved-vendor": ApprovedVendor,
    "po-entry": POEntry,
    "payment": Payment,
    "follow-up-vendor": FollowUpLifting,
    "transporter-follow-up": TransporterFollowUp,
    "material-received": MaterialReceived,
    "receipt-in-tally": BillingStage,
    "vendor-payment": Payment,
    "freight-payments": Payment,
    "order-cancel": OrderCancelPage,
};

export default function StagePage() {
    const params = useParams();
    const slug = (params?.slug || "") as string;

    const StageComponent = stageComponents[slug];

    if (!StageComponent) {
        return <div className="p-6">Stage not found {slug}</div>;
    }

    return <StageComponent />;
}
