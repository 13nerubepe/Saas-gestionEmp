# Sprint 3 sur 8 : l'argent de l'entreprise et ses clients

Planification du 5 novembre 2026, revue après le retour du professeur.

## Objectif

> Le fondateur sait combien il gagne, qui lui doit de l'argent, et comment le récupérer.

Le professeur a fixé deux thèmes pour ce sprint :

1. **Gestion financière** : sécuriser l'argent généré par l'activité, conseils en comptabilité et gestion financière (module M4).
2. **Gestion des clients** : prospection, facturation, rappels, fidélisation (module M5).

Les deux thèmes se rejoignent sur la facture. Le sprint construit une seule chaîne :
**client → facture → paiement → trésorerie → relance**, avec un agent comptable qui conseille.

Cas d'utilisation concernés (`diagrams/diagramme_de_cas_d_utilisation_uml_2.html`) :

| Cas d'utilisation | Stories |
|---|---|
| UC-04 Gérer les clients | US-03, US-04, US-23 |
| UC-05 Suivre l'activité commerciale | US-05, US-08, US-18 |
| UC-07 Facturer et suivre la trésorerie | US-14, US-15, US-17 |
| UC-02 Consulter un agent IA (question comptable et fiscale) | parmi US-11, US-12, US-16, US-19, US-20 |

Le rattachement exact de chaque élément ci-dessous à une US reste à confirmer dans le backlog.

## Décisions de planification

- **La validation humaine (M2) n'est pas un prérequis de ce sprint.** La règle ne s'applique qu'aux actions d'un agent qui ont un effet externe. Une facture créée par le fondateur lui-même n'en a pas besoin. Pour les relances, l'agent rédige le texte et le fondateur l'envoie lui-même (copier, email, WhatsApp) : rien ne part automatiquement. M2 arrive au sprint 4 avec l'envoi automatique.
- **L'agent comptable réutilise le pipeline de US-02** (recherche dans les textes, sources citées, avertissement). Il faut le rendre générique par domaine et charger l'Acte uniforme OHADA relatif au droit comptable (SYSCOHADA révisé) et le Code général des impôts du Cameroun, puis re-mesurer `LEGAL_SEARCH_MAX_DISTANCE`.
- **Sécuriser l'argent, concrètement :**
  - une facture émise est immuable et numérotée en continu, sans trou ; on corrige par un avoir ;
  - chaque paiement est rattaché à une facture ;
  - la trésorerie est saisie à la main (`CashMovement`) avec le moyen de paiement : espèces, MTN MoMo, Orange Money, banque ;
  - un seuil d'alerte de trésorerie ;
  - l'isolation entre entreprises est testée sur chaque endpoint.
- **Rien n'est codé en dur** : taux de TVA, mentions obligatoires des factures et devise (XAF) sont des données par pays.

## Engagement (environ 17 points)

| # | Élément | Thème | Qui | Points | État |
|---|---|---|---|---|---|
| 1 | US-03/04 : intégrer l'API clients et interactions, écrans liste et fiche | Clients, prospection | Front 1 + backend (revue) | 3 | Fait |
| 2 | Factures : app `billing`, `Invoice` et `InvoiceLine`, brouillon → émise → payée / en retard, numérotation, mentions et TVA par pays, écrans | Facturation | Backend + Front 2 | 5 | À faire |
| 3 | Paiements et trésorerie : `Payment`, `CashMovement`, solde, seuil d'alerte, vue « qui me doit quoi » | Sécuriser l'argent | Backend + Front 1 | 3 | À faire |
| 4 | Agent comptable et fiscal : pipeline US-02 généralisé, textes OHADA comptables et CGI Cameroun | Conseils en comptabilité | Backend | 3 | À faire |
| 5 | Relance des impayés : factures en retard, texte de relance rédigé par l'agent, envoyé par le fondateur | Rappels | Backend + Front 2 | 2 | À faire |
| 6 | Socle i18n frontend avant les nouveaux écrans | — | Front 2 | inclus | À faire |
| 7 | Création de l'EC2 et premier déploiement pour la démo | — | Backend | 1 | À faire |

## Definition of Done

1. Pull request liée à une story, relue, CI verte.
2. Services et permissions testés, avec au moins un test d'accès refusé à une autre entreprise par endpoint.
3. Schéma OpenAPI à jour et types frontend alignés.
4. Aucun texte affiché à l'utilisateur écrit en dur (FR/EN), codes d'erreur traduits.
5. Migrations propres (`makemigrations --check`), aucun secret commité.
6. Tout nouveau composant ou service Angular a un spec qui va au-delà de `should create`.
7. Testé à la main sur l'environnement de démo.

## Constat de l'élément 1

- `ng test` ne fonctionne pas aujourd'hui : le builder Karma ne résout pas l'alias `@/` de `src/assets/styles.scss` (« Can't find stylesheet to import »). Aucun spec frontend ne peut donc tourner, ni en local ni en CI. À corriger avant d'ajouter `ng test` à la CI (action qualité du QA). Le spec de `CrmService` passe (4 sur 4) quand on retire les styles globaux de la config de test.

## Sprint 4 pressenti

- Prospection : pipeline commercial (`Opportunity`), suivis datés (`FollowUp`), import de contacts.
- Fidélisation : indicateurs par client (chiffre d'affaires, ancienneté, dernier échange), relance des clients inactifs.
- Envoi automatique des relances : M2 (`ProposedAction` et journal d'audit), Celery et Redis.
- PDF des factures, CI frontend complète.

## Risques

1. **Charge** : 17 points pour 3 développeurs, le développeur backend étant partagé entre les éléments 2, 3, 4 et 7. Si le sprint déborde, l'élément 5 passe au sprint 4.
2. **Fiabilité des conseils** : l'agent comptable n'est fiable que si les textes chargés sont en vigueur. Le PO fournit les versions à jour en début de sprint.
