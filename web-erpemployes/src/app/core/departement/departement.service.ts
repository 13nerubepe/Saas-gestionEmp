import { inject, Injectable, signal } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { Departement } from './departement.model';

@Injectable({ providedIn: 'root' })
export class DepartementService {
    // 🔴 METTRE À false QUAND LE BACKEND SERA PRÊT
    private readonly USE_MOCK = true;

    // Données mockées pour la démo
    private readonly mockData = signal<Departement[]>([
        { id: 1, nom: 'Ressources Humaines', entreprise: 'Sakai Group', effectif: 12 },
        { id: 2, nom: 'Marketing', entreprise: 'Sakai Group', effectif: 8 },
        { id: 3, nom: 'Informatique', entreprise: 'Sakai Group', effectif: 15 },
        { id: 4, nom: 'Finance', entreprise: 'Sakai Group', effectif: 6 },
        { id: 5, nom: 'Commercial', entreprise: 'Sakai Group', effectif: 10 }
    ]);

    private nextId = 6;

    getAll(): Observable<Departement[]> {
        if (this.USE_MOCK) {
            return of([...this.mockData()]).pipe(delay(300));
        }
        // À décommenter quand l'API existera
        // return this.http.get<Departement[]>(`${DEPARTEMENT_URL}/`);
        return of([]);
    }

    create(dept: Omit<Departement, 'id'>): Observable<Departement> {
        if (this.USE_MOCK) {
            const nouveau: Departement = { ...dept, id: this.nextId++ };
            this.mockData.update((list) => [...list, nouveau]);
            return of(nouveau).pipe(delay(300));
        }
        // return this.http.post<Departement>(`${DEPARTEMENT_URL}/`, dept);
        return of(dept as Departement);
    }

    update(id: number, dept: Partial<Departement>): Observable<Departement> {
        if (this.USE_MOCK) {
            let updated!: Departement;
            this.mockData.update((list) =>
                list.map((d) => {
                    if (d.id === id) {
                        updated = { ...d, ...dept };
                        return updated;
                    }
                    return d;
                })
            );
            return of(updated).pipe(delay(300));
        }
        // return this.http.put<Departement>(`${DEPARTEMENT_URL}/${id}/`, dept);
        return of(dept as Departement);
    }

    delete(id: number): Observable<void> {
        if (this.USE_MOCK) {
            this.mockData.update((list) => list.filter((d) => d.id !== id));
            return of(void 0).pipe(delay(300));
        }
        // return this.http.delete<void>(`${DEPARTEMENT_URL}/${id}/`);
        return of(void 0);
    }
}
