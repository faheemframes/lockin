import { createClient } from "@supabase/supabase-js";

/*
 * A password-reset email link lands wherever Supabase sends it. If
 * /reset-password is missing from the dashboard's Redirect URLs, Supabase
 * falls back to the Site URL (/), the app sees a valid session and simply
 * signs the user in: they never get asked for a new password. Route any
 * recovery link to the reset page before the client consumes the tokens.
 */
if (
  typeof window !== "undefined" &&
  window.location.pathname !== "/reset-password" &&
  /(^|[#&])type=recovery(&|$)/.test(window.location.hash)
) {
  window.location.replace(`/reset-password${window.location.hash}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : null;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload an image to Supabase Storage (bucket "posts", under the uploader's
 * auth id) and return its public URL. Throws with a readable message on any
 * problem; there is deliberately no base64 fallback, because the API rejects
 * inline images (they bloated database rows).
 */
export async function uploadImage(file: File): Promise<string> {
  if (!supabase) throw new Error("Image uploads aren't configured on this server.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Use a JPG, PNG, WebP or GIF image.");
  if (file.size > MAX_BYTES) throw new Error("Images must be 5 MB or smaller.");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to upload images.");

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const name = `${auth.user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabase.storage.from("posts").upload(name, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type
  });
  if (error) throw new Error("Upload failed. Try again.");

  return supabase.storage.from("posts").getPublicUrl(name).data.publicUrl;
}
