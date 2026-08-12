import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Uploads an image (File or base64 Data URL) to Supabase Storage if configured.
 * If Supabase is not configured or the upload fails, it falls back to returning
 * the base64 string directly, keeping the application functional.
 */
export async function uploadImage(fileOrBase64: File | string): Promise<string> {
  if (!supabase) {
    console.warn("Supabase client is not configured. Falling back to direct URL / base64.");
    if (typeof fileOrBase64 === "string") {
      return fileOrBase64;
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrBase64);
    });
  }

  try {
    let file: Blob | File;
    let fileName: string;

    if (typeof fileOrBase64 === "string") {
      if (fileOrBase64.startsWith("data:")) {
        const arr = fileOrBase64.split(",");
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "image/png";
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        file = new Blob([u8arr], { type: mime });
        const ext = mime.split("/")[1] || "png";
        fileName = `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      } else {
        return fileOrBase64;
      }
    } else {
      file = fileOrBase64;
      const ext = (file as File).name?.split(".").pop() || "png";
      fileName = `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
    }

    const { data, error } = await supabase.storage
      .from("posts")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from("posts")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("Supabase upload failed, falling back to base64:", err);
    if (typeof fileOrBase64 === "string") {
      return fileOrBase64;
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrBase64);
    });
  }
}
