// Mirrors the API contract: see /api/docs/ on the backend.

export type MembershipRole = 'founder' | 'employee';

export interface Membership {
    company_id: string;
    company_name: string;
    country: string;
    role: MembershipRole;
}

export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    language: 'fr' | 'en';
    memberships: Membership[];
}

export interface AccessToken {
    access: string;
}

export interface RegisterPayload {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    language?: 'fr' | 'en';
    company_name: string;
    country?: string;
}

/** Error body returned by the API: `detail` + stable `code`, or per-field messages. */
export interface ApiError {
    detail?: string;
    code?: string;
    [field: string]: unknown;
}

export interface ProfileUpdate {
    first_name?: string;
    last_name?: string;
    language?: 'fr' | 'en';
}
