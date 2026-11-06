import { ClientKind, ClientStatus, InteractionKind } from './crm.service';

// Display labels for the API's stable choice values.
export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
    company: 'Entreprise',
    individual: 'Particulier'
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
    prospect: 'Prospect',
    active: 'Client actif',
    inactive: 'Inactif'
};

/** PrimeNG p-tag severity per status. */
export const CLIENT_STATUS_SEVERITY: Record<ClientStatus, 'info' | 'success' | 'secondary'> = {
    prospect: 'info',
    active: 'success',
    inactive: 'secondary'
};

export const INTERACTION_KIND_LABELS: Record<InteractionKind, string> = {
    call: 'Appel',
    email: 'Email',
    meeting: 'Rendez-vous',
    message: 'Message',
    note: 'Note'
};

export const INTERACTION_KIND_ICONS: Record<InteractionKind, string> = {
    call: 'pi pi-phone',
    email: 'pi pi-envelope',
    meeting: 'pi pi-users',
    message: 'pi pi-comment',
    note: 'pi pi-pencil'
};

/** [{ label, value }] for p-select. */
export function selectOptions<T extends string>(labels: Record<T, string>): { label: string; value: T }[] {
    return (Object.keys(labels) as T[]).map((value) => ({ label: labels[value], value }));
}
