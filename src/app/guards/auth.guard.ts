import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.isAuthenticated() && authService.currentUser) {
    return true;
  }
  

  const currentUrl = state.url;

  router.navigate(['/login'], { 
    queryParams: { returnUrl: currentUrl }
  });
  
  return false;
};