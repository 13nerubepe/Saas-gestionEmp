import { Component, OnInit } from '@angular/core';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { Slider } from 'primeng/slider';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Tag } from 'primeng/tag';
import { InputText } from 'primeng/inputtext';
import { ButtonDirective } from 'primeng/button';


@Component({
    selector: 'app-actif',
    standalone: true,
    imports: [TableModule, IconField, InputIcon, FormsModule, MultiSelect, Select, Slider, Tag, DatePipe, CurrencyPipe, InputText, ButtonDirective],
    templateUrl: './actif.html',
    styleUrl: './actif.scss'
})
export class ActifComponent implements OnInit {
    statuses: any[] = [];

    activityValues: number[] = [0, 100];

    isExpanded: boolean = false;

    balanceFrozen: boolean = false;

    loading: boolean = true;

    constructor() {}

    ngOnInit() {
        this.statuses = [
            { label: 'Unqualified', value: 'unqualified' },
            { label: 'Qualified', value: 'qualified' },
            { label: 'New', value: 'new' },
            { label: 'Negotiation', value: 'negotiation' },
            { label: 'Renewal', value: 'renewal' },
            { label: 'Proposal', value: 'proposal' }
        ];
    }

    formatCurrency(value: number) {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    // onGlobalFilter(table: Table, event: Event) {
    //     // table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    // }

    // clear(table: Table) {
    //     table.clear();
    //     this.filter.nativeElement.value = '';
    // }

    getSeverity(status: string) {
        switch (status) {
            case 'qualified':
            case 'instock':
            case 'INSTOCK':
            case 'DELIVERED':
            case 'delivered':
                return 'success';

            case 'negotiation':
            case 'lowstock':
            case 'LOWSTOCK':
            case 'PENDING':
            case 'pending':
                return 'warn';

            case 'unqualified':
            case 'outofstock':
            case 'OUTOFSTOCK':
            case 'CANCELLED':
            case 'cancelled':
                return 'danger';

            default:
                return 'info';
        }
    }
}
