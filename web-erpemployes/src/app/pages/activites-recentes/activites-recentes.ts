import { Component } from '@angular/core';
import { RecentActivity } from '@/app/model';
import { NgClass } from '@angular/common';
import { Divider } from 'primeng/divider';

@Component({
    selector: 'app-activites-recentes',
    imports: [NgClass, Divider],
    templateUrl: './activites-recentes.html',
    styleUrl: './activites-recentes.scss'
})
export class ActivitesRecentes {
    readonly activities: RecentActivity[] = [
        {
            title: 'Nouveau compte créé',
            description: 'Un nouveau compte fondateur a été enregistré.',
            date: 'Aujourd’hui',
            icon: 'pi-user-plus',
            color: 'text-blue-500',
            bg: 'bg-blue-100 dark:bg-blue-400/10'
        },
        {
            title: 'Profil mis à jour',
            description: 'Les informations du profil ont été modifiées.',
            date: 'Aujourd’hui',
            icon: 'pi-user-edit',
            color: 'text-green-500',
            bg: 'bg-green-100 dark:bg-green-400/10'
        },
        {
            title: 'Connexion à la plateforme',
            description: 'Une session utilisateur a été ouverte.',
            date: 'Hier',
            icon: 'pi-sign-in',
            color: 'text-orange-500',
            bg: 'bg-orange-100 dark:bg-orange-400/10'
        },
        {
            title: 'Paramètres de langue modifiés',
            description: 'La langue du profil a été mise à jour.',
            date: 'Il y a 2 jours',
            icon: 'pi-globe',
            color: 'text-purple-500',
            bg: 'bg-purple-100 dark:bg-purple-400/10'
        }
    ];
}
