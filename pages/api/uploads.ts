import { z } from "zod";

import { apiHandler } from "@/server/api";
import { approximateDataUriBytes, uploadDataUri } from "@/server/uploads";
import { AppError } from "@/server/errors";

export const config = { api: { bodyParser: { sizeLimit: "14mb" } } };

const uploadSchema = z.object({
  fileData: z.string().regex(/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,/i),
  originalName: z.string().trim().min(1).max(180),
  purpose: z.enum(["gallery", "documents", "newsletters", "school", "branches", "profiles", "shop"]),
});

type UploadResult = {
  url: string;
  publicId: string;
  bytes: number;
  originalName: string;
};

export default apiHandler<UploadResult>(
  { methods: ["POST"], roles: ["PRINCIPAL"] },
  async (req, res, context) => {
    const input = uploadSchema.parse(req.body);
    const bytes = approximateDataUriBytes(input.fileData);
    if (bytes > 8 * 1024 * 1024) {
      throw new AppError(413, "FILE_TOO_LARGE", "Files must be smaller than 8 MB.");
    }
    const isPdf = input.fileData.toLowerCase().startsWith("data:application/pdf");
    const uploaded = await uploadDataUri(
      input.fileData,
      `${context.user!.tenantId}/${input.purpose}`,
      isPdf ? "raw" : "image",
    );
    res.status(201).json({
      ok: true,
      data: {
        ...uploaded,
        bytes: uploaded.bytes || bytes,
        originalName: input.originalName,
      },
    });
  },
);
