const ADMIN_EMAIL = 'omveasna17@gmail.com';
const ADMIN_PASSWORD = 'Veasna1720@';
const AUTH_STORAGE_KEY = 'gallery_admin_session';

export function loginAdmin(email: string, password: string): boolean {
    const isValid =
        email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
        password === ADMIN_PASSWORD;

    if (isValid) {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    }

    return isValid;
}

export function logoutAdmin(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAdminAuthenticated(): boolean {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
}
