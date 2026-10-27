/**
 * Shared catalogue ceiling for product photographs.
 * The largest shawl folder has 10 images. Twelve leaves room for one or two more
 * in the admin editor. Image records store URLs, so this is not a file-size limit.
 * A folder with more files is reported, and the extra files stay out of the product.
 */
export const MAX_PRODUCT_IMAGES = 12;
