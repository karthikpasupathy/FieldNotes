import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const adminToastState = {
  toasts: [] as ToasterToast[],
};

function generateAdminToastId() {
  return Math.random().toString(36).substring(2, 9);
}

type AdminToaster = typeof adminToastState & {
  toast: (props: Omit<ToasterToast, "id">) => void;
  dismiss: (toastId?: string) => void;
};

const AdminToaster = React.createContext<AdminToaster>({
  ...adminToastState,
  toast: () => {},
  dismiss: () => {},
});

interface AdminToastContextProviderProps {
  children: React.ReactNode;
}

export function AdminToastProvider({
  children,
}: AdminToastContextProviderProps) {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([]);

  const toast = React.useCallback(
    ({ ...props }: Omit<ToasterToast, "id">) => {
      setToasts((prev) => {
        if (prev.length >= TOAST_LIMIT) {
          const filteredToasts = [...prev].slice(1);
          return [
            ...filteredToasts,
            { id: generateAdminToastId(), ...props },
          ];
        }

        return [...prev, { id: generateAdminToastId(), ...props }];
      });
    },
    [setToasts]
  );

  const dismiss = React.useCallback(
    (toastId?: string) => {
      if (toastId) {
        setToasts((prev) =>
          prev.filter((toast) => toast.id !== toastId)
        );
      } else {
        setToasts([]);
      }
    },
    [setToasts]
  );

  return (
    <AdminToaster.Provider
      value={{
        toasts,
        toast,
        dismiss,
      }}
    >
      {children}
    </AdminToaster.Provider>
  );
}

export const useAdminToast = () => {
  const context = React.useContext(AdminToaster);

  if (context === undefined) {
    throw new Error("useAdminToast must be used within a AdminToastProvider");
  }

  return context;
};