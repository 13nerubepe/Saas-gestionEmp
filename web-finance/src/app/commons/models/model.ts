
export interface ExpandedRows{
    [key: string]: boolean;

}

export interface Actualite{
    id: number;
    title: string;
    description: string;
    category: string;
    source: string;
    date: string;
    image: string;
    featured: boolean;
    url?: string;

}

export interface Actif {
    symbol: string;
    name: string;
    type: 'Crypto' | 'Action' | 'Indice' | 'Matière première';
    price: number;
    currency: string;
    var24h: number;
    volatility30: number;
    color: string;
    drift: number; // tendance utilisée pour les données de démo
}

export interface Periode {
    label: string;
    value: string;
    points: number;
}
