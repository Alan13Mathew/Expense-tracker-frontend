import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Expense } from '../../models/expense';
import { ExpenseService } from '../../services/expense.service';
import { AuthService } from '../../services/auth.service';
import { Chart } from 'chart.js/auto';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { AddExpenseComponent } from '../add-expense/add-expense.component';
import { MatDialog } from '@angular/material/dialog';
import { User } from '../../models/user';
import { LoadingService } from '../../services/loading.service';
import { DeleteConfirmationComponent } from '../delete-confirmation/delete-confirmation.component';
import { Router } from '@angular/router';
import { FileUploadComponent } from '../file-upload/file-upload.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit,OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  expenses: Expense[] = [];
  dataSource = new MatTableDataSource<Expense>();
  displayedColumns = ['date', 'category', 'description', 'type' , 'amount', 'actions'];
  categories = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Others'];
  
  totalExpenses = 0;
  monthlyTotal = 0;
  dailyAverage = 0;
  categoryChart: any;
  monthlyChart: any;

  timeRangeOptions = [
    { label: 'Last 3 Months', value: 3 },
    { label: 'Last 6 Months', value: 6 },
    { label: 'Last 12 Months', value: 12 },
    { label: 'All Time', value: 0 }
  ];
  selectedTimeRange = 6; 

  constructor(
    private expenseService: ExpenseService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private loadingService: LoadingService
  ) {}

  
  ngOnDestroy(): void {
    window.removeEventListener('resize',this.adjustDisplayedColumns);
  }

  ngOnInit() {
    this.loadExpenseData();
    this.adjustDisplayedColumns();
    window.addEventListener('resize',this.adjustDisplayedColumns.bind(this))
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadExpenseData() {
    const currentUser = this.authService.currentUser;
    if (currentUser?.id) {
      this.expenseService.getExpenses().subscribe({
        next: (expenses) => {
          this.expenses = this.filterExpensesByTimeRange(expenses).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());       

          this.dataSource.data = expenses;
          this.calculateStatistics();
          this.initializeCharts();
          //force material table to update
          this.dataSource._updateChangeSubscription();

        },
        error: (error) => {
          console.error('Expense Fetch Error:', error);
          if (error.status === 401) {
            this.authService.logout();
            this.router.navigate(['/login']);
          }
        }
      });
    }
  }

  openAddExpenseDialog(): void {
    const dialogRef = this.dialog.open(AddExpenseComponent, {
      width: '400px',
      data: { categories: this.categories }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.expenseService.getExpenses().subscribe({
          next: (expenses) => {
            this.expenses = expenses;        
            this.dataSource.data = expenses;
            this.calculateStatistics();
            this.initializeCharts();
          },
          error: (error) => {
            if (error.status === 401) {
              this.authService.logout();
              this.router.navigate(['/login']);
            }
          }
        });
      }
    });
  }
  

  deleteExpense(expenseId: string) {  // Changed to string for MongoDB ObjectId
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      panelClass: 'matrix-dialog'
    });
    
    dialogRef.afterClosed().subscribe(res => {
      if(res && expenseId) {
        this.loadingService.show();
        this.expenseService.deleteExpense(expenseId).subscribe({
          next: () => {
            // Refresh data after successful deletion
            this.loadExpenseData();
            this.loadingService.hide();
          },
          error: (error) => {
            console.error('Delete error:', error);
            this.loadingService.hide();
          }
        });
      }
    });
  }

  private filterExpensesByTimeRange(expenses: Expense[]): Expense[] {
    
    if (this.selectedTimeRange === 0) return expenses; // All time
  
    const today = new Date();
    const cutoffDate = new Date();
    cutoffDate.setMonth(today.getMonth() - this.selectedTimeRange);
  
    // Enhanced date filtering
    const filteredExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getTime() >= cutoffDate.getTime();
    });

    return filteredExpenses;
  }
  
  

  private calculateStatistics() {
    this.totalExpenses = this.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyExpenses = this.expenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
    });
    
    this.monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    this.dailyAverage = this.monthlyTotal / daysInMonth;
  }

  private initializeCharts() {
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }
    if (this.monthlyChart) {
      this.monthlyChart.destroy();
    }
    
    this.createCategoryChart();
    this.createMonthlyChart();
  }

    // New method to adjust displayed columns
    private adjustDisplayedColumns() {
      const screenWidth = window.innerWidth;
      if (screenWidth <= 768) {
        this.displayedColumns = ['date', 'category', 'amount', 'actions'];
      } else {
        this.displayedColumns = ['date', 'category', 'description', 'type', 'amount', 'actions'];
      }
    }

  private createCategoryChart() {
    const categoryData = this.expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);

    const ctx = document.getElementById('categoryChart') as HTMLCanvasElement;
    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(categoryData),
        datasets: [{
          data: Object.values(categoryData),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 10,
            bottom: 10
          }
        },
        plugins: {
          legend: {
            position: 'right',
            labels: { color: 'white', font:{ family: 'monospace',size:12},
          padding: 10 }
          }
        },
        elements: {
          arc: {
            borderWidth: 2,
            borderColor: '#000'
          }
        },parsing:{
          key: 'value'
        }
      }
    });
  }

  private createMonthlyChart() {

    const sortedExpenses = this.expenses.sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime())

    const monthlyData: Record<string,number> = {};

    const monthCount = this.selectedTimeRange || 12;
    for (let i = monthCount - 1 ; i >= 0; i--){
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const  monthKey = date.toLocaleString('default', { month: 'short' });

      const monthExpenses = sortedExpenses.filter(exp=>{
        const expDate = new Date(exp.date)
        return expDate.getMonth() === date.getMonth() && expDate.getFullYear() === date.getFullYear();
      })

      monthlyData[monthKey] = monthExpenses.reduce((sum,exp)=> sum + exp.amount, 0)

    }

    const ctx = document.getElementById('monthlyChart') as HTMLCanvasElement;
    this.monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(monthlyData),
        datasets: [{
          label: 'Monthly Expenses',
          data: Object.values(monthlyData),
          borderColor: '#36A2EB',
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(54, 162, 235, 0.2)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
            labels: { color: 'white', font:{family: 'monospace', size:12} }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: 'white' ,font: { family: 'monospace',size:10} ,maxTicksLimit :5}
            ,
            grid: { color: 'rgba(0, 255, 0, 0.1)' }
          },
          x: {
            reverse: true,
            ticks: { color: 'white',font: { 
              family: 'monospace', 
              size: 10 // Smaller font size for mobile
            },maxTicksLimit: 4 },
            
            grid: { display: false,color: 'rgba(0, 255, 0, 0.1)' }
          }
        },
        elements: {
          line: {
            borderColor: '#00ff00',
            tension: 0.4,
            borderWidth: 2
          },
          point: {
            backgroundColor: '#00ff00',
            borderColor: '#000',
            borderWidth: 2,
            radius: 6,
            hoverRadius: 8
          }
        },devicePixelRatio: 1,
        interaction:{
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  }

  openFileUploadDialog() {
    const dialogRef = this.dialog.open(FileUploadComponent, {
      width: '800px',
      height: '600px',
      panelClass: 'matrix-dialog'
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadExpenseData();
        this.calculateStatistics();
        this.initializeCharts();
        this.dataSource.data = this.expenses
        if(this.sort){
          this.dataSource.sort = this.sort;
        }
        if(this.paginator){
          this.dataSource.paginator = this.paginator;
        }
      }
    });
  }
  
}