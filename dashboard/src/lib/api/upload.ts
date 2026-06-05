/**
 * File upload utilities — wraps the multipart POST /files/upload endpoint.
 * Returns a file record with an id and url for serving.
 */
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type UploadedFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  storageKey: string;
  createdAt: string;
};

export type UploadResult = { file: UploadedFile };

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf', 'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) return `File too large (max 10 MB, got ${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  if (!ALLOWED_TYPES.includes(file.type)) return `File type not supported: ${file.type}`;
  return null;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
  const token = useAuthStore.getState().session?.accessToken;

  const fd = new FormData();
  fd.append('file', file);

  const resp = await fetch(`${baseURL}/files/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as Record<string, unknown>)?.message as string ?? `Upload failed (${resp.status})`);
  }

  const data = await resp.json() as { data: UploadResult; success: boolean };
  if (!data?.data?.file?.id) throw new Error('Upload response missing file id');
  return data.data;
}

/** React Query mutation hook for file uploads */
export function useFileUploadMutation() {
  return useMutation({ mutationFn: (file: File) => uploadFile(file) });
}

/** Derive a full absolute URL to serve a file */
export function fileServeUrl(fileId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
  return `${base}/files/${fileId}/serve`;
}
