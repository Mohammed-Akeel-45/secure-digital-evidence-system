import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { EvidenceVault } from '../../components/evidence/EvidenceVault';

export function UserEvidencePage() {
    return (
        <AppLayout activePage="evidence">
            <EvidenceVault
                title="Case Evidence Vault"
                subtitle="Manage, upload, download, and cryptographically verify evidence for your assigned cases"
            />
        </AppLayout>
    );
}
