import { Component } from '@angular/core';
import { CreatedUser } from '@/app/commons/created-user/created-user';

@Component({
    selector: 'app-create-user-entreprise',
    imports: [CreatedUser],
    templateUrl: './create-user.html',
    styleUrl: './create-user.scss'
})
export class CreateUser {}
