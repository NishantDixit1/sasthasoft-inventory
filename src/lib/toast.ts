"use client";

import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = ++seq;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience wrappers so call sites read as plain sentences. */
export const toast = {
  success: (title: string, description?: string) =>
    useToasts.getState().push({ tone: "success", title, description }),
  error: (title: string, description?: string) =>
    useToasts.getState().push({ tone: "error", title, description }),
  info: (title: string, description?: string) =>
    useToasts.getState().push({ tone: "info", title, description }),
};
