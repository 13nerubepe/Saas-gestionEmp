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
| 2 | Factures : app `billing`, `Invoice` et `InvoiceLine`, brouillon → émise → payée / en retard, numérotation, mentions et TVA par pays, écrans | Facturation | Backend + Front 2 | 5 | Fait |
| 3 | Paiements et trésorerie : `Payment`, `CashMovement`, solde, seuil d'alerte, vue « qui me doit quoi » | Sécuriser l'argent | Backend + Front 1 | 3 | Fait en partie : paiements, qui doit quoi, synthèse. Reste `CashMovement` et le seuil d'alerte |
| 4 | Agent comptable et fiscal : pipeline US-02 généralisé, textes OHADA comptables et CGI Cameroun | Conseils en comptabilité | Backend | 3 | Remplacé en partie : conseiller financier fondé sur les données (voir plus bas). Reste les textes OHADA comptables et le CGI |
| 5 | Relance des impayés : factures en retard, texte de relance rédigé par l'agent, envoyé par le fondateur | Rappels | Backend + Front 2 | 2 | Fait |
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

## Constat de l'élément 2 (factures)

Décisions prises, à valider par l'équipe :

- **Numérotation** : continue par entreprise et par année, `FAC-2026-0001`, attribuée à l'émission sous verrou de ligne (deux émissions simultanées n'obtiennent jamais le même numéro, un échec n'en saute aucun).
- **Facture émise figée** : plus de modification ni de suppression. L'émission copie le nom et le NIU du vendeur, le nom, le NIU et l'adresse du client. Une correction passera par un avoir (à faire).
- **Règles par pays** dans `billing/rules.py` : devise, décimales, taux de TVA, mentions obligatoires. Cameroun : XAF sans centimes, TVA 17,5 % + CAC 10 % de la TVA = 19,25 %, ou exonéré. À vérifier avec les textes du CGI chargés à l'élément 4.
- **Le NIU du vendeur est obligatoire** pour émettre. Nouvel endpoint `/api/v1/auth/company/` et section « Mon entreprise » dans le profil pour le saisir.
- **Sans échéance**, la facture est payable à réception (échéance = date d'émission).
- **Factures réservées aux fondateurs** (API et menu).
- **Arrondi** : chaque ligne est arrondie, puis sa TVA. L'aperçu de l'éditeur applique la même règle que l'API, avec un test de chaque côté sur les mêmes chiffres.

Pas encore fait : avoirs, RCCM et adresse du vendeur sur la facture, PDF (l'impression du navigateur donne un document propre), fuseau horaire par entreprise (les dates suivent `TIME_ZONE=UTC`, donc une facture émise entre minuit et 1 h à Douala porte la date de la veille).

## Conseiller financier et commercial (demande du fondateur, 5 novembre)

Ajouté à la demande de l'équipe, pour la partie IA des modules finance et CRM :

- **Paiements** (US-15) : espèces, MTN Mobile Money, Orange Money, virement, chèque (règles par pays). Jamais au-delà du reste dû ; la facture passe à « Payée » quand elle est soldée.
- **Qui me doit quoi** (US-17), calculé en base : par client, montant dû, part en retard, jours de retard ; ancienneté des impayés (0, 1-30, 31-60, 61-90, +90 jours) ; facturé et encaissé du mois et de l'année ; situation financière et retard moyen de paiement de chaque client.
- **Conseiller IA** (`advisor`) : répond sur la trésorerie, les relances, la prospection (ciblage à partir des meilleurs clients et de l'activité des prospects) et la fidélisation (clients actifs sans contact depuis 60 jours). Il ne voit que des faits numérotés calculés par l'application, cite ceux qu'il utilise (vérifiés par le code), affiche sa fiabilité et renvoie vers un expert-comptable quand elle est faible.
- **Relance rédigée par l'agent** (élément 5) : WhatsApp ou email, ton cordial ou ferme ; le fondateur relit, modifie et envoie lui-même.

## Sprint 4 pressenti

- Prospection : pipeline commercial (`Opportunity`), suivis datés (`FollowUp`), import de contacts.
- Fidélisation : indicateurs par client (chiffre d'affaires, ancienneté, dernier échange), relance des clients inactifs.
- Envoi automatique des relances : M2 (`ProposedAction` et journal d'audit), Celery et Redis.
- PDF des factures, CI frontend complète.

## Risques

1. **Charge** : 17 points pour 3 développeurs, le développeur backend étant partagé entre les éléments 2, 3, 4 et 7. Si le sprint déborde, l'élément 5 passe au sprint 4.
2. **Fiabilité des conseils** : l'agent comptable n'est fiable que si les textes chargés sont en vigueur. Le PO fournit les versions à jour en début de sprint.
