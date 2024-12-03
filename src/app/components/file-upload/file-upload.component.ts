import { Component } from '@angular/core';
import { Papa } from 'ngx-papaparse';
import * as XLSX from 'xlsx'
import { UploadService } from '../../services/upload.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss'
})
export class FileUploadComponent {
  isAnalyzing = false;
  isUploading = false;
  showPreview = false;
  showGuide = false;
  parsedTransactions: any[] = [];
  dataSource = new MatTableDataSource<any>();
  selection = new SelectionModel<any>(true, []);
  selectedFile: File | null = null;
  displayedColumns: string[] = ['select', 'date', 'description', 'amount', 'category', 'type'];

  constructor(
    private papa: Papa,
    private uploadService: UploadService,
    private dialogRef: MatDialogRef<FileUploadComponent>,
    private snackbar: MatSnackBar
  ) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.analyzeFile(files[0]);
    }
  }

  showGuidefn(){
    this.showGuide = !this.showGuide;
  }

  onFileSelect(event: any) {
    const file = event.target.files[0];
    if (this.isValidFileType(file)) {
      this.selectedFile = file;
    } else {
      this.snackbar.open('Please select an Excel or CSV file', 'Close', {
        duration: 3000
      });
    }
  }

  isValidFileType(file: File): boolean {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    return validTypes.includes(file.type);
  }

  removeFile() {
    this.selectedFile = null;
  }

  uploadFile() {
    if (this.selectedFile) {
      this.analyzeFile(this.selectedFile);
    }
  }

  async analyzeFile(file: File) {
    this.isAnalyzing = true;
    await new Promise(resolve=> setTimeout(resolve,2000))

    if (file.type.includes('excel') || file.name.endsWith('.xlsx')) {
      this.handleExcelFile(file);
    } else {
      this.handleCsvFile(file);
    }
  }

  handleExcelFile(file:File){
    const reader = new FileReader();
    reader.onload = (e:any)=>{
      const data = e.target.result;
      const workbook = XLSX.read(data,{type: 'array'});
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      this.parsedTransactions = this.transformData(jsonData);
      this.dataSource.data = this.parsedTransactions;
      this.isAnalyzing = false;
      this.showPreview = true;
    };
    reader.readAsArrayBuffer(file)
  }

  handleCsvFile(file: File){
    try {
      const reader = new FileReader();
      
      reader.onload = (e: any) => {
        const csvData = e.target.result;
        
        this.papa.parse(csvData, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            console.log('Parsed Data:', result.data); // Debug log
            
            if (this.validateCSVFormat(result.data)) {
              this.parsedTransactions = this.transformData(result.data);
              this.dataSource.data = this.parsedTransactions;
              this.isAnalyzing = false;
              this.showPreview = true;
              
              this.snackbar.open('File analyzed successfully!', 'Close', {
                duration: 3000
              });
            } else {
              this.isAnalyzing = false;
              this.snackbar.open('Invalid file format. Check the sample format.', 'Close', {
                duration: 3000
              });
            }
          },
          error: (error) => {
            console.error('Parsing error:', error);
            this.isAnalyzing = false;
            this.snackbar.open('Error parsing file', 'Close', {
              duration: 3000
            });
          }
        });
      };
  
      reader.readAsText(file);
    } catch (error) {
      this.isAnalyzing = false;
      this.snackbar.open('Error reading file', 'Close', {
        duration: 3000
      });
    }

  }

  validateCSVFormat(data: any[]): boolean {
    if (!data || data.length === 0) return false;
    
    const requiredColumns = ['date', 'description', 'amount', 'category', 'type'];
    const headers = Object.keys(data[0]);
    
    return requiredColumns.every(col => headers.includes(col));
  }

  transformData(data: any[]) {
    return data.map(row => {
      // Convert Excel serial number to JavaScript Date
      const excelDate = parseInt(row.date);
      let properDate;
      
      if (!isNaN(excelDate)) {
        // Excel dates are counted from 1900-01-01
        properDate = new Date((excelDate - 25569) * 86400 * 1000);
      } else {
        properDate = new Date(row.date);
      }
      
      console.log('Excel date:', row.date);
      console.log('Converted date:', properDate.toISOString());
      
      return {
        date: properDate.toISOString(),
        description: row.description?.trim() || '',
        amount: Math.abs(parseFloat(row.amount)),
        category: row.category?.trim() || '',
        type: row.type?.toLowerCase() || ''
      };
    });
  }
  
  

  async importSelected() {
    this.isUploading = true;
    const selectedTransactions = this.selection.selected;

    await new Promise(resolve=> setTimeout(resolve,2000))
    
    try {
      const result = await this.uploadService.saveTransactions(selectedTransactions).toPromise();
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Import failed:', error);
    }
    finally{
      this.isUploading = false;
    }
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  masterToggle() {
    this.isAllSelected() ?
      this.selection.clear() :
      this.dataSource.data.forEach(row => this.selection.select(row));
  }

  toggleRow(row: any) {
    this.selection.toggle(row);
  }
}
