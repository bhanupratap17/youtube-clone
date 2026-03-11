const deleteFromCloudinary = async (filePublic_id, resourceType) => {
  try {
    if (!filePublic_id) return null;
    const response = await cloudinary.uploader.destroy(filePublic_id, {
      resource_type: resourceType,
    });
    return response;
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    return null;
  }
};

export { deleteFromCloudinary };
