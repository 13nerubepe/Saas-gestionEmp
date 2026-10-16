import { Component } from '@angular/core';
import { CreatedUser } from '@/app/commons/created-user/created-user';
import { CreatedEntreprise } from '@/app/commons/created-entreprise/created-entreprise';

@Component({
    selector: 'app-create-user-entreprise',
    imports: [CreatedUser, CreatedEntreprise],
    templateUrl: './create-user-entreprise.html',
    styleUrl: './create-user-entreprise.scss'
})
export class CreateUserEntreprise {}
