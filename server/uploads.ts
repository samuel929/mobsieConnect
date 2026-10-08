import { cloudinaryClient } from "./cloudinary";
import { AppError } from "./errors";

export async function uploadDataUri(
  dataUri: string,
  folder: string,
  resourceType: "image" | "raw" = "image",
) {
  try {
    const result = await cloudinaryClient().uploader.upload(dataUri, {
      folder: `mobsie-connect/${folder}`,
      resource_type: resourceType,
      overwrite: false,
      unique_filename: true,
      type: "upload",
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error("Cloudinary upload failed", error);
    throw new AppError(502, "UPLOAD_FAILED", "The file could not be uploaded. Please try again.");
  }
}

export function approximateDataUriBytes(dataUri: string) {
  const encoded = dataUri.split(",")[1] ?? "";
  return Math.ceil((encoded.length * 3) / 4);
}
