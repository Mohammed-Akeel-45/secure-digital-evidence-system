import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { EvidenceVault } from '../../components/evidence/EvidenceVault';

export function AdminEvidencePage() {
    return (
        <AppLayout activePage="evidence">
            <EvidenceVault
                title="Evidence Vault"
                subtitle="Cryptographically verified digital evidence repository & integrity audit verification"
            />
        </AppLayout>
    );
}
