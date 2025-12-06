export const API_URL = import.meta.env.VITE_API_URL || '';

export function getApiUrl(path: string) {
    if (path.startsWith('http')) return path;
    return `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
}
