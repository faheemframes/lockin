// Augment NextApiRequest to support Express-style req.params used by CommonJS controllers
import "next";

declare module "next" {
  interface NextApiRequest {
    params?: Record<string, string>;
    user?: { id: string; email: string };
  }
}
