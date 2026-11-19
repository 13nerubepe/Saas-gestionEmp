import { ClientKind, ClientStatus, FollowUpChannel, InteractionKind } from './crm.service';

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

/** US-05: how the founder plans to get back to the client. */
export const FOLLOW_UP_CHANNEL_LABELS: Record<Exclude<FollowUpChannel, ''>, string> = {
    call: 'Appel',
    whatsapp: 'WhatsApp',
    email: 'Email',
    meeting: 'Rendez-vous',
    other: 'Autre'
};

export const FOLLOW_UP_CHANNEL_ICONS: Record<FollowUpChannel, string> = {
    '': 'pi pi-bell',
    call: 'pi pi-phone',
    whatsapp: 'pi pi-whatsapp',
    email: 'pi pi-envelope',
    meeting: 'pi pi-users',
    other: 'pi pi-bell'
};

/** yyyy-mm-dd in local time, `days` from today, for <input type="date">. */
export function localDate(days = 0): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** "Aujourd'hui", "Demain", "En retard de 3 j" or null for a later date. */
export function relativeDay(isoDate: string): string | null {
    const days = Math.round((Date.parse(isoDate) - Date.parse(localDate(0))) / 86400000);
    if (days === 0) return 'Aujourd’hui';
    if (days === 1) return 'Demain';
    if (days < 0) return `En retard de ${-days} j`;
    return null;
}
