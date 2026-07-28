"use client";

import { AuthProvider } from "@/lib/auth-context";
import { WorkflowProvider } from "@/lib/workflow-context";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <WorkflowProvider>
                {children}
            </WorkflowProvider>
        </AuthProvider>
    );
}
