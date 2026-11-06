/** DRF page: `next` / `previous` are full URLs, or null. */
export interface Page<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}
