
export interface ExpandedRows{
    [key: string]: boolean;

}

export interface User_Role {
    id: number;
    name: string;
    email: string;
    avatar: string;
    role: 'Administrateur' | 'RH' | 'Manager' | 'Employé';
    status: 'Actif' | 'Inactif';
}

export interface AccessRequestPayload {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    position: string;
    company_name: string;
    country: string;
    city: string;
    reason: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface AuthResponse {
    access: string;
    refresh: string;
}

export interface Country {
    label: string;
    value: string;
}

export interface RecentActivity {
    title: string;
    description: string;
    date: string;
    icon: string;
    color: string;
    bg: string;
}

