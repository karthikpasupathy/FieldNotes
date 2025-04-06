import { QueryClient } from "@tanstack/react-query";

export const adminQueryClient = new QueryClient();

type Options = {
  on401: "throw" | "returnNull";
};

export function getAdminQueryFn({ on401 }: Options) {
  return async function adminQueryFn<T>({ queryKey }: { queryKey: any[] }): Promise<T> {
    try {
      const endpoint = queryKey[0] as string;
      const response = await fetch(endpoint);
      
      if (response.status === 401) {
        if (on401 === "returnNull") {
          return null as T;
        } else {
          throw new Error("Unauthorized: Please login to continue");
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }
      
      if (response.status === 204) {
        return null as T;
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  };
}

export async function adminApiRequest(
  method: string,
  endpoint: string,
  data?: unknown
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  return response;
}