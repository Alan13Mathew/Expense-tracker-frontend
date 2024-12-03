import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class UploadService {

  private apiUrl = `${environment.apiUrl}`

  constructor(private http: HttpClient) { }

  // uploadFile(formData: FormData){
  //   return this.http.post(`${this.apiUrl}/upload`,formData)
  // }

  saveTransactions(transactions: any[]) {
    return this.http.post(`${this.apiUrl}/expenses/bulk`, transactions);
  }

}
