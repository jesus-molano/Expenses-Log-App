import { createClient } from "@/utils/supabase/server";

export type AppSession = {
  userEmail: string | null;
  isCloudReady: boolean;
};

export async function getAppSession(): Promise<AppSession> {
  const supabase = await createClient();

  if (!supabase) {
    return {
      userEmail: null,
      isCloudReady: false,
    };
  }

  const { data } = await supabase.auth.getUser();

  return {
    userEmail: data.user?.email ?? null,
    isCloudReady: true,
  };
}
